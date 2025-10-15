// /api/updateCache.js
import { updateCacheEntry } from "./cache.js";

export default async function handler(req, res) {
  // --- 🔐 CORS 允许来源 ---
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:4321"]; // 默认允许本地调试访问

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // --- 处理预检请求 ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 仅允许 POST 请求
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ success: false, error: "Method Not Allowed" });
    }

    // 兼容 req.body 或 req.json()
    const body =
      typeof req.body === "object" && req.body !== null
        ? req.body
        : await req.json?.();

    const { key, value } = body || {};

    if (!key || value === undefined) {
      return res
        .status(400)
        .json({ success: false, error: "Missing key or value" });
    }

    const result = await updateCacheEntry(key, value);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("❌ 更新缓存失败：", err);
    res.status(500).json({ success: false, error: err.message });
  }
}