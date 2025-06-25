import express, { Router } from "express";
import axios from "axios";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { parseReq, getStatusColor } from "./utils";

const app = express();
const router = Router();

app.use(cors({}));

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_KEY || ""
);
router.get("/", (_req, res) => {
  res.status(200).set("Content-Type", "text/plain").send("Hej dobio sam ");
});

router.post("/auth", async (req, res) => {
  const body = parseReq(req);
  const client_id = body.client_id;
  const code = body.code;
  console.log({ code, client_id });
  const options = {
    method: "POST",
    url: "https://api.miro.com/v1/oauth/token",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    data: {
      grant_type: "authorization_code",
      client_id: client_id,
      client_secret: process.env.MIRO_CLIENT_SECRET,
      code: code,
      redirect_uri: process.env.MIRO_REDIRECT_URI,
    },
  };
  axios
    .request(options)
    .then(async (r: any) => {
      const { error } = await supabase.from("auth").upsert(
        {
          userId: r.data.user_id,
          accessToken: r.data.access_token,
        },
        { onConflict: "userId" }
      );
      console.log(error);
      if (error) {
        res.status(500).end();
        return;
      } else {
        console.log(r.data);
        return res
          .status(200)
          .set("Content-Type", "application/json")
          .send({ user_id: r.data.user_id, team_id: r.data.team_id });
      }
    })
    .catch(console.log);
});

router.post("/", async (req: any, res: any) => {
  const body = parseReq(req);
  const PBIId = body.resource?.workItemId;
  const title = body.resource?.revision?.fields?.["System.Title"];
  const status = body.resource?.revision?.fields?.["System.State"];
  const userId = req.query.userId;
  const boardId = req.query.boardId;
  console.log({ PBIId, title, status });

  // Get MIROID from supabase
  const { data: dataAuth, error: errorAuth } = await supabase
    .from("auth")
    .select("userId, accessToken")
    .eq("userId", userId);
  const accessToken = dataAuth?.[0]?.accessToken;

  if (!accessToken || errorAuth) {
    console.log(errorAuth || "User not found!");
    res.status(200).send("Not Found").end();
    return;
  }

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
        boardId || ""
      )}/app_cards/${appCardId}`,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
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
        boardId || ""
      )}/app_cards/${appCardId}`,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      data: {
        style: {
          fillColor: getStatusColor(status),
        },
        data: {
          title,
          fields: [...(currentAppCardData?.data?.fields || [])],
        },
      },
    };
    (options.data.data.fields[0] = {
      ...options.data.data.fields[0],
      value: status,
      textColor: "#000000",
      fillColor: getStatusColor(status),
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
