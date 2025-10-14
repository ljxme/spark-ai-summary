/* 
  GitHub JSON 缓存系统 (自动压缩 + 自动创建)
  用于在 Vercel / Astro 项目中替代本地 IndexedDB。
*/

import { gzipSync, gunzipSync } from "fflate";

const REPO_OWNER = process.env.GITHUB_OWNER;
const REPO_NAME = process.env.GITHUB_REPO;
const FILE_PATH = process.env.GITHUB_CACHE_PATH || "data/cache.json";
const TOKEN = process.env.GITHUB_TOKEN;

// 🚀 工具函数：请求 GitHub REST API
async function githubRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API 请求失败: ${res.status} ${text}`);
  }
  return res.json();
}

// 🧠 获取缓存内容
export async function getCache() {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const data = await githubRequest(url);
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    const json = JSON.parse(decoded);

    // 自动解压 gzip 内容
    if (json.compressed) {
      const binary = Buffer.from(json.data, "base64");
      const decompressed = gunzipSync(binary);
      const text = new TextDecoder().decode(decompressed);
      return JSON.parse(text);
    } else {
      return json;
    }
  } catch (err) {
    if (err.message.includes("404")) {
      console.log("📦 未找到缓存文件，正在自动创建空缓存...");
      await setCache({});
      return {};
    }
    console.warn("⚠️ 无法加载缓存：", err.message);
    return {};
  }
}

// 💾 写入缓存内容
export async function setCache(newData) {
  try {
    const metaUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

    // Step 1️⃣ 尝试获取现有文件 SHA（若不存在则为 null）
    let sha = null;
    try {
      const meta = await githubRequest(metaUrl);
      sha = meta.sha;
    } catch (e) {
      if (e.message.includes("404")) {
        console.log("📄 新建缓存文件...");
      } else {
        throw e;
      }
    }

    // Step 2️⃣ 压缩数据
    const jsonString = JSON.stringify(newData);
    const compressed = gzipSync(new TextEncoder().encode(jsonString));
    const encoded = Buffer.from(compressed).toString("base64");

    // Step 3️⃣ 构建上传内容
    const bodyData = {
      compressed: true,
      data: encoded,
      updated_at: new Date().toISOString(),
    };

    // Step 4️⃣ 上传或新建文件
    await githubRequest(metaUrl, {
      method: "PUT",
      body: JSON.stringify({
        message: sha ? "update cache" : "create cache",
        content: Buffer.from(JSON.stringify(bodyData, null, 2)).toString("base64"),
        ...(sha ? { sha } : {}), // 有 sha 就更新，无 sha 就创建
      }),
    });

    console.log("✅ 缓存已更新并压缩上传至 GitHub。");
  } catch (err) {
    console.error("❌ 写入缓存失败：", err.message);
  }
}

// 🧩 追加/更新单条缓存（推荐调用）
export async function updateCacheEntry(key, value) {
  const cache = await getCache();
  cache[key] = value;
  await setCache(cache);
  return value;
}