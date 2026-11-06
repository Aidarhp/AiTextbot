require("dotenv/config");

const { createServer } = require("node:http");
const https = require("node:https");

const port = Number(process.env.API_PORT) || 3001;
const model = process.env.GOOGLE_MODEL || "gemini-3.8-flash";
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

function generateWithGoogleAI(prompt) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  });

  return new Promise((resolve, reject) => {
    const request = https.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GOOGLE_API_KEY,
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
            reject(new Error("Google AI returned an invalid response."));
          }
        });
      },
    );

    request.setTimeout(60_000, () => {
      request.destroy(new Error("Google AI request timed out."));
    });
    request.on("error", reject);
    request.end(body);
  });
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !isLocalOrigin(origin)) {
    sendJson(response, 403, {
      error: "Requests from this origin are not allowed.",
    });
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

  if (!process.env.GOOGLE_API_KEY) {
    sendJson(response, 503, {
      error:
        "Google AI is not configured. Add GOOGLE_API_KEY to .env and restart the app.",
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
    const upstreamResponse = await generateWithGoogleAI(prompt);
    const result = upstreamResponse.data;

    if (upstreamResponse.status === 429) {
      sendJson(response, 429, {
        error:
          "Google AI Studio is limiting requests for this model. Check your Gemini API quota and billing, or try again after the limit resets.",
      });
      return;
    }

    if (upstreamResponse.status < 200 || upstreamResponse.status >= 300) {
      sendJson(response, upstreamResponse.status, {
        error: result.error?.message || "Google AI could not generate a response.",
      });
      return;
    }

    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter((part) => typeof part === "string")
      .join("");
    if (typeof text !== "string" || !text.trim()) {
      sendJson(response, 502, {
        error: "Google AI returned an empty or invalid response.",
      });
      return;
    }

    sendJson(response, 200, { text });
  } catch (error) {
    const timedOut = error.message === "Google AI request timed out.";
    sendJson(response, timedOut ? 504 : 502, {
      error: timedOut
        ? "The request to Google AI timed out. Please try again."
        : error.message ||
          "Could not reach Google AI. Check your connection and try again.",
    });
  }
});

server.listen(port, () => {
  console.log(`Text generator API listening on http://localhost:${port}`);
});
