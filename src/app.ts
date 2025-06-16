import express, { Router } from "express";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { getStatusColor } from "./getColors";

const app = express();
const router = Router();

app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_KEY || ""
);

router.get("/", (_req, res) => {
  res.status(200).set("Content-Type", "text/plain").send("Hello, World!");
});

router.post("/", async (req: any, res: any) => {
  let body;

  // If body is a Buffer
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString("utf-8");
    body = JSON.parse(text);
  } else if (typeof req.body === "string") {
    body = JSON.parse(req.body);
  } else {
    body = req.body;
  }
  const PBIId = body.resource?.workItemId;
  const title = body.resource?.revision?.fields?.["System.Title"];
  const status = body.resource?.revision?.fields?.["System.State"];
  console.log({ PBIId, title, status });

  // Get MIROID from supabase
  const { data, error } = await supabase
    .from("PBI-mapping")
    .select("miroCardId, created_at, azurePBIId")
    .eq("azurePBIId", PBIId);
  const appCardId = data?.[0]?.miroCardId;

  if (!appCardId || error) {
    console.log(error || "PBI not found in DB!");
    res.status(200).send("Not Found").end();
    return;
  }

  const getAppCard = async () => {
    const options = {
      method: "GET",
      url: `https://api.miro.com/v2/boards/${encodeURI(
        process.env.MIRO_BOARD_ID || ""
      )}/app_cards/${appCardId}`,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${process.env.MIRO_ACCESS_TOKEN}`,
      },
    };

    return await axios
      .request(options)
      .then((res) => res.data)
      .catch(console.log);
  };

  const updateAppCard = async () => {
    const currentAppCardData = await getAppCard();
    if (!currentAppCardData?.id) {
      res.send(200).end();
      return;
    }
    const options = {
      method: "PATCH",
      url: `https://api.miro.com/v2/boards/${encodeURI(
        process.env.MIRO_BOARD_ID || ""
      )}/app_cards/${appCardId}`,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${process.env.MIRO_ACCESS_TOKEN}`,
      },
      style: {
        cardTheme: getStatusColor(status),
        fillBackground: true,
      },
      data: {
        data: {
          title,
          fields: [...(currentAppCardData?.data?.fields || [])],
        },
      },
    };
    (options.data.data.fields[0] = {
      value: status,
      iconShape: "square",
      fillColor: getStatusColor(status),
      textColor: "#000000",
      iconUrl: "https://cdn-icons-png.flaticon.com/512/3867/3867669.png",
    }),
      axios
        .request(options)
        .then(() => {
          res.send(200).end();
        })
        .catch(console.log);
  };

  updateAppCard();
});

app.use("/", router);

export { app, router };
