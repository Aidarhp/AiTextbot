require("dotenv/config");

const { createServer } = require("node:http");
const https = require("node:https");

const port = Number(process.env.API_PORT) || 3001;
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const maxPromptLength = 4000;

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function isLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function generateWithOpenAI(prompt) {
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const request = https.request(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (upstreamResponse) => {
        let responseBody = "";
        upstreamResponse.setEncoding("utf8");
        upstreamResponse.on("data", (chunk) => {
          responseBody += chunk;
        });
        upstreamResponse.on("end", () => {
          try {
            resolve({
              status: upstreamResponse.statusCode || 502,
              data: JSON.parse(responseBody),
            });
          } catch {
            reject(new Error("OpenAI returned an invalid response."));
          }
        });
      },
    );

    request.setTimeout(60_000, () => {
      request.destroy(new Error("OpenAI request timed out."));
    });
    request.on("error", reject);
    request.end(body);
  });
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !isLocalOrigin(origin)) {
    sendJson(response, 403, { error: "Requests from this origin are not allowed." });
    return;
  }
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/generate") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, {
      error: "OpenAI is not configured. Add OPENAI_API_KEY to .env and restart the app.",
    });
    return;
  }

  let rawBody = "";
  for await (const chunk of request) {
    rawBody += chunk;
    if (Buffer.byteLength(rawBody) > 16_384) {
      sendJson(response, 413, { error: "Request is too large." });
      return;
    }
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    sendJson(response, 400, { error: "Request body must be valid JSON." });
    return;
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > maxPromptLength) {
    sendJson(response, 400, {
      error: `Enter a prompt between 1 and ${maxPromptLength} characters.`,
    });
    return;
  }

  try {
    const upstreamResponse = await generateWithOpenAI(prompt);
    const result = upstreamResponse.data;

    if (upstreamResponse.status < 200 || upstreamResponse.status >= 300) {
      sendJson(response, upstreamResponse.status, {
        error: result.error?.message || "OpenAI could not generate a response.",
      });
      return;
    }

    const text = result.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      sendJson(response, 502, { error: "OpenAI returned an empty or invalid response." });
      return;
    }

    sendJson(response, 200, { text });
  } catch (error) {
    const timedOut = error.message === "OpenAI request timed out.";
    sendJson(response, timedOut ? 504 : 502, {
      error: timedOut
        ? "The request to OpenAI timed out. Please try again."
        : error.message || "Could not reach OpenAI. Check your connection and try again.",
    });
  }
});

server.listen(port, () => {
  console.log(`Text generator API listening on http://localhost:${port}`);
});
