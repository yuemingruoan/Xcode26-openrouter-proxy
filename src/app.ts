#!/usr/bin/env node
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import * as https from 'https';

const app = express();
const OPENROUTER_API_URL = "https://openrouter.ai";

app.use(express.json());

// 添加 CORS 中间件
app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

function logRequest(url: string, headers: any, method: string, body?: any) {
    console.log(`\n--- Sending ${method} request to ${url} ---`);
    console.log("Headers:");
    for (const key in headers) {
        if (key.toLowerCase() === 'authorization') {
            console.log(`  ${key}: Bearer *** (desensitized)`);
        } else {
            console.log(`  ${key}: ${headers[key]}`);
        }
    }

    if (body) {
        console.log("Body:");
        console.log(JSON.stringify(body, null, 2));
    }
    console.log("--- End of request ---\n");
}

const httpsAgent = new https.Agent({
    keepAlive: true,
    timeout: 30000,
    rejectUnauthorized: process.env.DISABLE_SSL_VERIFY !== 'true'
});

app.get('/v1/models', async (req: Request, res: Response) => {
    try {
        const headers = { ...req.headers };
        delete headers['host'];
        headers['Host'] = "openrouter.ai";

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const url = `${OPENROUTER_API_URL}/api/v1/models`;
        logRequest(url, headers, "GET");

        const response = await axios.get(url, { headers, httpsAgent });
        const openrouterData = response.data;

        let allowedModels = new Set<string>();
        const filterPath = process.env.MODEL_FILTER_FILE;

        const fs = require('fs');
        if (filterPath && fs.existsSync(filterPath)) {
            try {
                const data = fs.readFileSync(filterPath, 'utf8');
                data.split('\n').forEach((line: string) => {
                    const modelId = line.trim();
                    if (modelId) {
                        allowedModels.add(modelId);
                    }
                });
            } catch (e: any) {
                console.error(`Error reading model filter file at ${filterPath}: ${e}`);
            }
        }

        if (allowedModels.size > 0) {
            openrouterData.data = openrouterData.data.filter((model: any) => allowedModels.has(model.id));
        }

        const openaiModels = {
            object: "list",
            data: openrouterData.data.map((model: any) => ({
                id: model.id,
                object: "model",
                created: model.created,
                owned_by: model.id.includes("/") ? model.id.split("/")[0] : "unknown"
            }))
        };

        res.json(openaiModels);

    } catch (error: any) {
        console.error(error);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.post('/v1/chat/completions', async (req: Request, res: Response) => {
    try {
        if (req.headers['content-type'] !== 'application/json') {
            throw new Error("Content-Type must be application/json");
        }

        const body = req.body;
        const headers: any = {
            'Content-Type': 'application/json',
            'User-Agent': 'OpenRouter-Proxy/1.0'
        };

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(401).json({ error: "Missing OpenRouter API key" });
        }
        headers['Authorization'] = `Bearer ${apiKey}`;

        const url = `${OPENROUTER_API_URL}/api/v1/chat/completions`;
        logRequest(url, headers, "POST", body);

        const stream = body.stream || false;

        if (stream) {
            // 设置 SSE 响应头
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control',
                'X-Accel-Buffering': 'no' // 禁用nginx缓冲
            });

            const response = await axios.post(url, body, {
                headers,
                httpsAgent,
                responseType: 'stream',
                timeout: 60000,
            });

            let buffer = '';
            
            response.data.on('data', (chunk: Buffer) => {
                const chunkStr = chunk.toString();
                buffer += chunkStr;
                
                // 处理完整的事件
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留不完整的行
                
                for (const line of lines) {
                    if (line.trim()) {
                        // 过滤掉 OpenRouter 的处理信息
                        if (line.startsWith(': OPENROUTER PROCESSING')) {
                            continue;
                        }
                        
                        // 确保正确的 SSE 格式
                        if (line.startsWith('data: ') || line.startsWith('event: ') || line.startsWith('id: ')) {
                            res.write(line + '\n');
                        } else if (line.trim() === '') {
                            res.write('\n');
                        }
                    }
                }
            });

            response.data.on('end', () => {
                // 处理剩余的缓冲区内容
                if (buffer.trim()) {
                    const lines = buffer.split('\n');
                    for (const line of lines) {
                        if (line.trim() && !line.startsWith(': OPENROUTER PROCESSING')) {
                            if (line.startsWith('data: ') || line.startsWith('event: ') || line.startsWith('id: ')) {
                                res.write(line + '\n');
                            }
                        }
                    }
                }
                res.write('\n');
                res.end();
            });

            response.data.on('error', (error: any) => {
                console.error('Stream error:', error);
                res.write(`data: {"error": "${error.message}"}\n\n`);
                res.end();
            });

            // 处理客户端断开连接
            req.on('close', () => {
                response.data.destroy();
            });

        } else {
            const response = await axios.post(url, body, {
                headers,
                httpsAgent,
                timeout: 30000,
            });
            
            res.json(response.data);
        }

    } catch (error: any) {
        console.error('Request error:', error);
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            res.status(502).json({
                error: "Connection error with OpenRouter API",
                details: error.message
            });
        } else if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// 健康检查端点
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 测试 OpenRouter 连接的端点
app.get('/test-connection', async (req: Request, res: Response) => {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(401).json({ error: "Missing OpenRouter API key" });
        }

        const response = await axios.get(`${OPENROUTER_API_URL}/api/v1/models`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'OpenRouter-Proxy/1.0'
            },
            httpsAgent,
            timeout: 10000
        });

        res.json({
            status: 'connected',
            modelCount: response.data.data?.length || 0,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Connection test failed:', error.message);
        res.status(500).json({
            error: 'Connection test failed',
            details: error.message,
            code: error.code
        });
    }
});

const port = parseInt(process.env.PORT || '8080');

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
    console.log(`API address: http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Connection test: http://localhost:8080/test-connection`);
});
