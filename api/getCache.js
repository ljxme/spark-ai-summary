// /api/getCache.js
import { getCache } from "./cache.js";

export default async function handler(req, res) {
  try {
    const cache = await getCache();
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ success: true, data: cache });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}