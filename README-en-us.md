# Overview

Apple has updated the AI features in Xcode 26, allowing calls to local or third-party AI services. However, OpenRouter does not seem to use the standard OpenAI API, which prevents Xcode from directly integrating with OpenRouter. This project provides a middleware layer that converts OpenRouter's API into a format supported by Xcode. This project is adapted from [https://github.com/Kirow/OpenRouterXcodeProxy.git](https://github.com/Kirow/OpenRouterXcodeProxy.git), but the original project is currently not functioning properly.

# Usage

**Build the Project**
   ```bash
   cd your-project-directory
   ./build.sh
   ```
**Run the Project**
  ```bash
  cd ./proxy/dist
  export OPENROUTER_API_KEY=your-api-key
  ./app
  ```
**Optional Command-Line Options**
```bash
export PORT=program-port (default: 8080)
```
**Xcode Configuration**

Go to Settings - Intelligence - Add a model provider..., select Locally Hosted, and enter the port (default: 8080; if you set a different port, use that instead).

**Q&A**

**Q**: Why can't the Claude-4-opus model be used?<br>
**A**: Because OpenRouter defaults to using models provided by Anthropic, and there seems to be an issue with OpenRouter's routing here. This is not a problem with this project; you will get the same result if you access it directly on the OpenRouter official website. Currently, we can only wait for OpenRouter to fix the routing.
