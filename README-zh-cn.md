# Xcode26-openrouter-proxy
中文 | [English](README.md)


## 概述

苹果在Xcode 26中更新了ai功能，可以调用本地或服务商提供的ai，但是openrouter使用的似乎不是标准的openai api，导致了Xcode无法直接接入openrouter使用，本项目提供了一个中间层，将openrouter的api转换成Xcode支持的格式。本项目改编自此https://github.com/Kirow/OpenRouterXcodeProxy.git ，但原项目目前已无法正常使用

## 使用

### 安裝
```sh
npm install -g @shiyu/xcode26-openrouter-proxy
```

### 启动

```sh
opentransapi
```

## Q&A

**Q**:为什么Claude-4-opus模型无法使用<br>
**A**:因为openrouter默认使用Anthropic提供的模型，而openrouter的路由在这里似乎出了点问题，这并不是本项目的问题，如果你直接在openrouter官网访问也会得到相同的结果，目前只能等待openrouter修复路由
