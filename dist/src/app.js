"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = exports.app = void 0;
const express_1 = __importStar(require("express"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const supabase_js_1 = require("@supabase/supabase-js");
const utils_1 = require("./utils");
const app = (0, express_1.default)();
exports.app = app;
const router = (0, express_1.Router)();
exports.router = router;
app.use((0, cors_1.default)());
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || "", process.env.SUPABASE_KEY || "");
router.get("/", (_req, res) => {
    res.status(200).set("Content-Type", "text/plain").send("Hello, World!");
});
router.post("/auth", async (req, res) => {
    const body = (0, utils_1.parseReq)(req);
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
    axios_1.default
        .request(options)
        .then(async (r) => {
        const { error } = await supabase.from("auth").upsert({
            userId: r.data.user_id,
            accessToken: r.data.access_token,
        }, { onConflict: "userId" });
        console.log(error);
        if (error) {
            res.status(500).end();
            return;
        }
        else {
            console.log(r.data);
            return res
                .status(200)
                .set("Content-Type", "application/json")
                .send({ user_id: r.data.user_id, team_id: r.data.team_id });
        }
    })
        .catch(console.log);
});
router.post("/", async (req, res) => {
    const body = (0, utils_1.parseReq)(req);
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
            url: `https://api.miro.com/v2/boards/${encodeURI(boardId || "")}/app_cards/${appCardId}`,
            headers: {
                accept: "application/json",
                authorization: `Bearer ${accessToken}`,
            },
        };
        return await axios_1.default
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
            url: `https://api.miro.com/v2/boards/${encodeURI(boardId || "")}/app_cards/${appCardId}`,
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                authorization: `Bearer ${accessToken}`,
            },
            style: {
                cardTheme: (0, utils_1.getStatusColor)(status),
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
            fillColor: (0, utils_1.getStatusColor)(status),
            textColor: "#000000",
            iconUrl: "https://cdn-icons-png.flaticon.com/512/3867/3867669.png",
        }),
            axios_1.default
                .request(options)
                .then(() => {
                res.send(200).end();
            })
                .catch(console.log);
    };
    updateAppCard();
});
app.use("/", router);
