// --- 可能不再需要 ---
import crypto from 'crypto'; // 若不用可以删掉

// --- 从环境变量读取敏感信息 ---
const APPID = process.env.SPARK_APPID; // 可能仍需要
const API_SECRET = process.env.SPARK_API_SECRET; // 用于新鉴权
const API_KEY = process.env.SPARK_API_KEY;       // 用于新鉴权

// --- Spark API 地址 (兼容 OpenAI 格式) ---
const SPARK_API_URL = "https://spark-api-open.xf-yun.com/v1/chat/completions";
// --- 确认 Lite 版或其他模型在新 API 中的标识符 ---
const MODEL_NAME = "lite"; // 请根据官方文档确认正确的模型名称

// --- Vercel Serverless Function 主体 ---
export default async function handler(req, res) {
    // --- 动态 import node-fetch ---
    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;

    // --- 设置 CORS 响应头 ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // --- 处理 OPTIONS 预检请求 ---
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // --- 处理 POST 请求 ---
    if (req.method === 'POST') {
        // 检查必要的环境变量是否设置
        if (!API_KEY || !API_SECRET || !APPID) {
            console.error("Server Error: Spark environment variables not configured.");
            return res.status(500).json({ error: "服务器内部错误：API凭证未配置" });
        }

        try {
            const { content, title } = req.body;

            if (!content) {
                return res.status(400).json({ error: "请求体缺少 'content' 字段" });
            }

            // --- 构造符合 OpenAI 格式的请求体 ---
            const requestData = {
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: "你是一个有用的助手，请根据用户提供的文章标题和内容生成一段简洁的摘要。" },
                    { role: "user", content: `文章标题：${title || '无标题'}\n文章内容：${content}` }
                ],
                temperature: 0.5,
                max_tokens: 200
            };

            // --- 构造请求头 (!!! 鉴权方式请核对官方文档 !!!) ---
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}:${API_SECRET}`
            };

            // --- 发送请求到 Spark API ---
            const sparkResponse = await fetch(SPARK_API_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestData)
            });

            if (!sparkResponse) {
                console.error("Proxy Error: Failed to fetch Spark API.");
                return res.status(500).json({ error: '代理服务器未能连接到 Spark API' });
            }

            const sparkData = await sparkResponse.json();

            // --- 处理 Spark API 的响应 ---
            if (sparkResponse.ok && sparkData.choices && sparkData.choices.length > 0 && sparkData.choices[0].message) {
                const assistantMessage = sparkData.choices[0].message;
                if (assistantMessage.role === 'assistant' && assistantMessage.content) {
                    const summary = assistantMessage.content.trim();
                    return res.status(200).json({ summary });
                } else {
                    console.error("Spark response parsing error:", sparkData);
                    return res.status(500).json({ error: "未能从 Spark 获取有效摘要内容" });
                }
            } else if (sparkData.error) {
                console.error("Spark API Error:", sparkData.error.message);
                return res.status(sparkResponse.status || 500).json({
                    error: `Spark API 错误: ${sparkData.error.message} (Code: ${sparkData.error.code || 'N/A'})`
                });
            } else if (!sparkResponse.ok) {
                console.error("Spark request failed:", sparkResponse.status, sparkData);
                let errorMessage = `获取摘要失败，状态码: ${sparkResponse.status}`;
                if (sparkData && typeof sparkData === 'object') {
                    errorMessage += ` - ${JSON.stringify(sparkData)}`;
                } else if (typeof sparkData === 'string') {
                    errorMessage += ` - ${sparkData}`;
                }
                return res.status(sparkResponse.status).json({ error: errorMessage });
            } else {
                console.error("Spark request failed or unexpected format:", sparkResponse.status, sparkData);
                return res.status(sparkResponse.status || 500).json({
                    error: `获取摘要失败，状态码: ${sparkResponse.status}, 响应格式未知`
                });
            }

        } catch (error) {
            console.error("Proxy Error:", error);
            if (error instanceof SyntaxError) {
                console.error("Failed to parse Spark API response as JSON.");
                return res.status(500).json({ error: '代理服务器错误：无法解析 Spark API 响应' });
            }
            return res.status(500).json({ error: '代理服务器内部错误', details: error.message });
        }
    } else {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

// --- 可能需要的辅助函数 ---
// function generateSparkToken(apiKey, apiSecret) {
//     // ... 根据讯飞文档实现 Token 生成逻辑 ...
//     return "generated_token_string";
// }

// 作者: konoXIN
// 链接: https://www.konoxin.top/posts/db7b3418
// 来源: XIN's Blog | 前端开发 | Vue.js & JavaScript 技术分享
// 著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。