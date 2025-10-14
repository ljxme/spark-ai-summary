// /api/updateCache.js
import { updateCacheEntry } from "./cache.js";

export default async function handler(req, res) {
  try {
    // 仅允许 POST 请求
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    const { key, value } = await req.json ? await req.json() : req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ success: false, error: "Missing key or value" });
    }

    const result = await updateCacheEntry(key, value);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("❌ 更新缓存失败：", err);
    res.status(500).json({ success: false, error: err.message });
  }
}