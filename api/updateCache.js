// /api/updateCache.js
import fetch from "node-fetch";

const REPO_OWNER = process.env.GITHUB_OWNER;              // GitHub 用户名
const REPO_NAME = process.env.GITHUB_REPO || "spark-ai-summary";     // 仓库名
const FILE_PATH = process.env.GITHUB_CACHE_PATH || "data/cache.json"; // 缓存文件路径
const BRANCH = process.env.GITHUB_BRANCH || "main";                  // 分支名
const TOKEN = process.env.GITHUB_TOKEN;                              // Token 环境变量

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

    // --- 获取请求体 ---
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

    if (!TOKEN) {
      throw new Error("Missing GITHUB_TOKEN environment variable.");
    }

    // --- 1️⃣ 拉取当前缓存文件 ---
    const fileUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const fileResponse = await fetch(fileUrl, {
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch cache.json: ${fileResponse.statusText}`);
    }

    const fileData = await fileResponse.json();
    const sha = fileData.sha;
    const content = Buffer.from(fileData.content, "base64").toString("utf8");
    const cache = JSON.parse(content || "{}");

    // --- 2️⃣ 更新缓存 ---
    cache[key] = value;

    // --- 3️⃣ Base64 编码并推送 ---
    const newContent = Buffer.from(JSON.stringify(cache, null, 2)).toString("base64");
    const updateResponse = await fetch(fileUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Update cache: ${key}`,
        content: newContent,
        sha,
        branch: BRANCH,
      }),
    });

    if (!updateResponse.ok) {
      const errText = await updateResponse.text();
      throw new Error(`GitHub update failed: ${errText}`);
    }

    const result = await updateResponse.json();
    console.log(`✅ GitHub cache updated for "${key}"`);

    res.status(200).json({ success: true, message: "Cache updated successfully", commit: result.commit });
  } catch (err) {
    console.error("❌ 更新缓存失败：", err);
    res.status(500).json({ success: false, error: err.message });
  }
}