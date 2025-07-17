"use strict";

#!/usr/bin/env node

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const app = (0, express_1.default)();
const OPENROUTER_API_URL = "https://openrouter.ai";
function logRequest(url, headers, method, body) {
    console.log(`\n--- Sending ${method} request to ${url} ---`);
    console.log("Headers:");
    for (const key in headers) {
        if (key.toLowerCase() === 'authorization') {
            console.log(`  ${key}: Bearer *** (desensitized)`);
        }
        else {
            console.log(`  ${key}: ${headers[key]}`);
        }
    }
    if (body) {
        console.log("Body:");
        if (process.env.NODE_ENV === 'development') {
            console.log(JSON.stringify(body, null, 2));
        }
    }
    console.log("--- End of request ---\n");
}
app.get('/v1/models', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const headers = Object.assign({}, req.headers);
        delete headers['host'];
        headers['Host'] = "openrouter.ai";
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const url = `${OPENROUTER_API_URL}/api/v1/models`;
        logRequest(url, headers, "GET");
        const verifySSL = process.env.DISABLE_SSL_VERIFY !== 'true';
        const response = yield axios_1.default.get(url, { headers, httpsAgent: verifySSL ? undefined : new (require('https').Agent)({ rejectUnauthorized: false }) });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const openrouterData = response.data;
        let allowedModels = new Set();
        const filterPath = process.env.MODEL_FILTER_FILE;
        const fs = require('fs');
        if (filterPath && fs.existsSync(filterPath)) {
            try {
                const fs = require('fs');
                const data = fs.readFileSync(filterPath, 'utf8');
                data.split('\n').forEach((line) => {
                    const modelId = line.trim();
                    if (modelId) {
                        allowedModels.add(modelId);
                    }
                });
            }
            catch (e) {
                console.error(`Error reading model filter file at ${filterPath}: ${e}`);
            }
        }
        if (allowedModels.size > 0) {
            openrouterData.data = openrouterData.data.filter((model) => allowedModels.has(model.id));
        }
        const openaiModels = {
            object: "list",
            data: openrouterData.data.map((model) => ({
                id: model.id,
                object: "model",
                created: model.created,
                owned_by: model.id.includes("/") ? model.id.split("/")[0] : "unknown"
            }))
        };
        res.json(openaiModels);
    }
    catch (error) {
        console.error(error);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
}));
app.post('/v1/chat/completions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.headers['content-type'] !== 'application/json') {
            throw new Error("Content-Type must be application/json");
        }
        const body = req.body;
        const headers = Object.assign({}, req.headers);
        delete headers['host'];
        headers['Host'] = "openrouter.ai";
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(401).json({ error: "Missing OpenRouter API key" });
        }
        headers['Authorization'] = `Bearer ${apiKey}`;
        const url = `${OPENROUTER_API_URL}/api/v1/chat/completions`;
        logRequest(url, headers, "POST", body);
        const stream = body.stream || false;
        const verifySSL = process.env.DISABLE_SSL_VERIFY !== 'true';
        const response = yield axios_1.default.post(url, body, {
            headers,
            httpsAgent: verifySSL ? undefined : new (require('https').Agent)({ rejectUnauthorized: false }),
            responseType: stream ? 'stream' : 'json'
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            response.data.pipe(res);
        }
        else {
            res.json(response.data);
        }
    }
    catch (error) {
        console.error(error);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
}));
const port = parseInt(process.env.PORT || '8080');
app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
    console.log(`API address: http://localhost:${port}`);
});
