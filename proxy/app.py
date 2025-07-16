import requests
import json
import os
from flask import Flask, request, jsonify, Response, stream_with_context
import traceback  # 新增：用于打印异常栈

app = Flask(__name__)

OPENROUTER_API_URL = "https://openrouter.ai"

def log_request(url, headers, method, body=None):
    """Log request details for debugging"""
    print(f"\n--- Sending {method} request to {url} ---")
    print("Headers:")
    for key, value in headers.items():
        if key.lower() == 'authorization':
            print(f"  {key}: Bearer *** (desensitized)")  # 新增：脱敏密钥
        else:
            print(f"  {key}: {value}")
    
    if body:
        print("Body:")
        print(json.dumps(body, indent=2))
    print("--- End of request ---\n")

@app.route('/v1/models', methods=['GET'])
def get_models():
    """Return models in OpenAI format, optionally filtered by filter-models.txt"""
    try:
        # Forward all headers except Host
        headers = dict(request.headers)
        if 'Host' in headers:
            del headers['Host']
        
        # Set correct Host for OpenRouter API
        target_host = "openrouter.ai"
        headers['Host'] = target_host
        
        # 新增：添加 Authorization 从环境变量
        api_key = os.environ.get('OPENROUTER_API_KEY')
        if api_key:
            headers['Authorization'] = f"Bearer {api_key}"
        
        # Log and send request
        url = f"{OPENROUTER_API_URL}/api/v1/models"
        log_request(url, headers, "GET")
        
        # Disable SSL verification if environment variable is set
        verify_ssl = os.environ.get('DISABLE_SSL_VERIFY') != 'true'
        response = requests.get(url, headers=headers, verify=verify_ssl)
        response.raise_for_status()
        openrouter_data = response.json()
        
        # Load allowed models from filter file if specified
        allowed_models = set()
        filter_path = os.environ.get('MODEL_FILTER_FILE')
        
        if filter_path and os.path.exists(filter_path):
            try:
                with open(filter_path, 'r') as f:
                    for line in f:
                        model_id = line.strip()
                        if model_id:  # Skip empty lines
                            allowed_models.add(model_id)
            except Exception as e:
                print(f"Error reading model filter file at {filter_path}: {e}")
        
        # Filter models if we have entries
        if allowed_models:
            openrouter_data["data"] = [
                model for model in openrouter_data["data"]
                if model["id"] in allowed_models
            ]
        
        # Transform to OpenAI format
        openai_models = {
            "object": "list",
            "data": [
                {
                    "id": model["id"],
                    "object": "model",
                    "created": model["created"],
                    "owned_by": (model["id"].split("/")[0] if "/" in model["id"] else "unknown")  # 修改：安全拆分
                }
                for model in openrouter_data["data"]
            ]
        }
        return jsonify(openai_models)
    
    except requests.exceptions.HTTPError as http_err:
        # 新增：转发原 HTTP 错误
        try:
            error_data = http_err.response.json()
            return jsonify(error_data), http_err.response.status_code
        except:
            return jsonify({"error": str(http_err)}), http_err.response.status_code
    except Exception as e:
        traceback.print_exc()  # 新增：打印栈到控制台
        return jsonify({"error": str(e)}), 500

@app.route('/v1/chat/completions', methods=['POST'])
def chat_completions():
    """Proxy chat completions to OpenRouter"""
    try:
        # 新增：显式检查 Content-Type 和解析 JSON
        if request.content_type != 'application/json':
            raise ValueError("Content-Type must be application/json")
        
        try:
            body = request.get_json(force=False)  # 修改：使用 get_json()，不强制解析
        except Exception as parse_error:
            traceback.print_exc()  # 打印栈
            return jsonify({"error": f"Invalid JSON body: {str(parse_error)}"}), 400
        
        # Forward all headers except Host
        headers = dict(request.headers)
        if 'Host' in headers:
            del headers['Host']
        
        # Set correct Host for OpenRouter API
        target_host = "openrouter.ai"
        headers['Host'] = target_host
        
        # 新增：添加 Authorization 从环境变量
        api_key = os.environ.get('OPENROUTER_API_KEY')
        if api_key:
            headers['Authorization'] = f"Bearer {api_key}"
        else:
            return jsonify({"error": "Missing OpenRouter API key"}), 401
        
        url = f"{OPENROUTER_API_URL}/api/v1/chat/completions"
        log_request(url, headers, "POST", body)
        
        # Set stream=True to handle streaming responses
        stream = body.get('stream', False)
        
        # Disable SSL verification if environment variable is set
        verify_ssl = os.environ.get('DISABLE_SSL_VERIFY') != 'true'
        response = requests.post(url, headers=headers, json=body, stream=stream, verify=verify_ssl)
        response.raise_for_status()
        
        if stream:
            def generate():
                try:
                    for chunk in response.iter_content(chunk_size=1024):  # 改为 iter_content 以处理 raw bytes
                        if chunk:
                            try:
                                # 显式解码为 UTF-8 字符串
                                decoded_chunk = chunk.decode('utf-8', errors='replace')  # 'replace' 处理任何无效字节
                                lines = decoded_chunk.splitlines()
                                for line in lines:
                                    if line.strip() and ": OPENROUTER PROCESSING" not in line:
                                        yield (line + '\n').encode('utf-8')  # 重新编码为 UTF-8 bytes
                            except UnicodeDecodeError as decode_err:
                                print(f"DEBUG: Decode error in chunk: {decode_err}")
                                yield f"data: [ERROR] Encoding issue in chunk\n\n".encode('utf-8')
                except Exception as stream_error:
                    traceback.print_exc()  # 打印栈
                    yield f"data: [ERROR] {str(stream_error)}\n\n".encode('utf-8')  # 新增：发送错误到流中
                
            return Response(stream_with_context(generate()),
                            status=response.status_code,
                            content_type='text/event-stream; charset=utf-8')  # 强制 UTF-8
        else:
            # 非 stream: 确保内容是 UTF-8
            try:
                content = response.content.decode('utf-8', errors='replace').encode('utf-8')
                return Response(content,
                                status=response.status_code,
                                content_type='application/json; charset=utf-8')
            except UnicodeDecodeError:
                return jsonify({"error": "Encoding error in response"}), 500
    
    except requests.exceptions.HTTPError as http_err:
        # 新增：转发原 HTTP 错误
        try:
            error_data = http_err.response.json()
            return jsonify(error_data), http_err.response.status_code
        except:
            return jsonify({"error": str(http_err)}), http_err.response.status_code
    except Exception as e:
        traceback.print_exc()  # 新增：打印栈到控制台
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
