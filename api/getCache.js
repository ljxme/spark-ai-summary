// /api/getCache.js
import { getCache } from "./cache.js";

export default async function handler(req, res) {
  // --- 🔐 允许的跨域来源（可以改成从环境变量读取） ---
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",") // 支持多个域名，用逗号分隔
    : ["http://localhost:4321"]; // 默认允许这些域

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // --- 处理 OPTIONS 预检请求 ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const cache = await getCache();
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ success: true, data: cache });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}