/* 
  GitHub JSON 缓存系统 (自动压缩 + 自动创建 + 可选过期)
  用于在 Vercel / Astro 项目中替代本地 IndexedDB。
*/

import * as fflate from "fflate";

// 环境变量
const { gzipSync, gunzipSync } = fflate;
const REPO_OWNER = process.env.GITHUB_OWNER;
const REPO_NAME = process.env.GITHUB_REPO;
const FILE_PATH = process.env.GITHUB_CACHE_PATH || "data/cache.json";
const TOKEN = process.env.GITHUB_TOKEN || ""; // 可选鉴权
const MAX_AGE_DAYS = parseInt(process.env.GITHUB_CACHE_MAX_AGE || "7", 10); // 缓存有效天数，默认 7 天

// 🚀 工具函数：请求 GitHub REST API
async function githubRequest(url, options = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
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
    let cache = {};
    if (json.compressed && json.data) {
      const binary = Buffer.from(json.data, "base64");
      const decompressed = gunzipSync(binary);
      const text = new TextDecoder().decode(decompressed);
      cache = JSON.parse(text);
    } else {
      cache = json;
    }

    // 🔹 检查缓存是否过期
    const updatedAt = json.updated_at ? new Date(json.updated_at).getTime() : 0;
    const ageMs = Date.now() - updatedAt;
    const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    if (ageMs > maxAgeMs) {
      console.log(`⏳ 缓存已过期（>${MAX_AGE_DAYS}天），正在清空...`);
      await setCache({});
      return {};
    }

    return cache;
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

//写入缓存内容
export async function setCache(newData) {
  try {
    const metaUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

    // Step 1 尝试获取现有文件 SHA（若不存在则为 null）
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

    // Step 2️ 压缩数据
    const jsonString = JSON.stringify(newData);
    const compressed = gzipSync(new TextEncoder().encode(jsonString));
    const encoded = Buffer.from(compressed).toString("base64");

    // Step 3️ 构建上传内容
    const bodyData = {
      compressed: true,
      data: encoded,
      updated_at: new Date().toISOString(),
    };

    // Step 4️ 上传或新建文件
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

// 追加/更新单条缓存（GitHub 自动写入版）
export async function updateCacheEntry(key, value) {
  if (!key || value === undefined) {
    throw new Error("updateCacheEntry 调用错误：必须提供 key 和 value");
  }

  try {
    // 1️⃣ 获取当前缓存
    const cache = await getCache();

    // 2️⃣ 更新指定 key
    cache[key] = value;

    // 3️⃣ 写回 GitHub（自动压缩 + base64）
    await setCache(cache);

    console.log(`✅ 缓存已更新并写入 GitHub: ${key}`);
    return value;
  } catch (err) {
    console.error(`❌ 更新缓存失败: ${key}`, err.message);
    throw err; // 抛出错误供上层 API 捕获
  }
}