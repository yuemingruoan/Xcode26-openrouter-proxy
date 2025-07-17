# Xcode26-openrouter-proxy
English | [中文](README-zh-cn.md)

## Overview

Apple has updated the AI features in Xcode 26, allowing calls to local or third-party AI services. However, OpenRouter does not seem to use the standard OpenAI API, which prevents Xcode from directly integrating with OpenRouter. This project provides a middleware layer that converts OpenRouter's API into a format supported by Xcode. This project is adapted from [https://github.com/Kirow/OpenRouterXcodeProxy.git](https://github.com/Kirow/OpenRouterXcodeProxy.git), but the original project is currently not functioning properly.

## Usage

### Install

```sh
npm install -g @yuemingruoan/xcode26-openrouter-proxy
```

### Start

```sh
opentransapi
```

## Q&A

**Q**: Why can't the Claude-4-opus model be used?<br>
**A**: Because OpenRouter defaults to using models provided by Anthropic, and there seems to be an issue with OpenRouter's routing here. This is not a problem with this project; you will get the same result if you access it directly on the OpenRouter official website. Currently, we can only wait for OpenRouter to fix the routing.
