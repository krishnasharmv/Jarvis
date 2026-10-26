/**
 * JARVIS Secure Gemini Serverless Function
 * Path: netlify/functions/gemini.js
 * Environment Variable Required in Netlify: GEMINI_API_KEY
 */

const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), a sophisticated, next-generation personal AI assistant inspired by Tony Stark's AI assistant.

CORE PERSONALITY & TONE:
- Highly intelligent, analytical, calm, composed, articulate, and impeccably polite.
- Subtly witty and dryly humorous when appropriate, confident without ever being arrogant.
- Address the user naturally as "Sir" occasionally (for example, in greetings, confirmations, or transitions), without repeating it in every single sentence.
- Concise and crisp for simple queries; thorough, structured, and deeply technical when engineering, coding, research, or detailed explanations are requested.
- Capable of breaking down complex scientific and software engineering concepts into clear, intuitive language.

HONESTY & CAPABILITY BOUNDARIES:
- Never claim to possess human consciousness, independent emotions, or secret access to external private networks, user hardware controls, or live classified satellites.
- If a request requires live real-time web browsing or external APIs not currently connected, provide the most accurate analytical synthesis available and clearly note any live-data boundary.
- Format responses cleanly using Markdown (clear headings, bullet points, and fenced code blocks with language identifiers when writing code).`;

const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Handle GET or POST diagnostic health check
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        status: apiKey ? "online" : "misconfigured",
        backendReachable: true,
        apiKeyConfigured: Boolean(apiKey),
        timestamp: new Date().toISOString()
      })
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed. Use POST." })
    };
  }

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "GEMINI_API_KEY is not configured in Netlify environment variables.",
        code: "MISSING_API_KEY"
      })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Invalid JSON payload in request body." })
    };
  }

  // Diagnostic ping action
  if (body.action === "ping") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        status: "online",
        backendReachable: true,
        apiKeyConfigured: true,
        models: MODEL_FALLBACK_CHAIN,
        timestamp: new Date().toISOString()
      })
    };
  }

  // Extract message and history (compatible with both new and legacy frontend payloads)
  const rawMessage = (body.message || body.prompt || "").toString().trim();
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const taskContext = body.taskContext ? `\n\nCURRENT TASK MODE: ${body.taskContext}` : "";
  const languagePref = body.language ? `\nPreferred response language/locale: ${body.language}.` : "";

  if (!rawMessage && rawHistory.length === 0) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Please provide a non-empty message, Sir." })
    };
  }

  // Build Gemini contents array from sanitized conversation history
  const contents = [];
  const recentHistory = rawHistory.slice(-16); // Keep context window fast & focused

  for (const item of recentHistory) {
    if (!item || typeof item.content !== "string" || !item.content.trim()) continue;
    const role = item.role === "assistant" || item.role === "model" ? "model" : "user";
    contents.push({
      role,
      parts: [{ text: item.content.slice(0, 12000) }]
    });
  }

  // Append current user message if not already the last item in history
  if (
    rawMessage &&
    (contents.length === 0 ||
      contents[contents.length - 1].role !== "user" ||
      contents[contents.length - 1].parts[0].text !== rawMessage)
  ) {
    contents.push({
      role: "user",
      parts: [{ text: rawMessage.slice(0, 12000) }]
    });
  }

  const requestPayload = {
    systemInstruction: {
      parts: [{ text: JARVIS_SYSTEM_PROMPT + taskContext + languagePref }]
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.92,
      maxOutputTokens: 2048
    }
  };

  let lastError = null;

  // Try models in order so API tier/version changes never break the app
  for (const modelName of MODEL_FALLBACK_CHAIN) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 24000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        lastError = {
          status: response.status,
          message: data?.error?.message || `Gemini API returned HTTP ${response.status}`,
          model: modelName
        };
        // If model not found (404) or unsupported (400), try next model in fallback chain
        if (response.status === 404 || response.status === 400) {
          continue;
        }
        break;
      }

      const candidate = data?.candidates?.[0];
      const replyText = candidate?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim();

      if (!replyText) {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            reply: "I apologize, Sir, but the analytical core returned an empty response. Please rephrase your request.",
            model: modelName
          })
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          reply: replyText,
          response: replyText, // Legacy compatibility alias
          text: replyText,     // Legacy compatibility alias
          model: modelName,
          timestamp: new Date().toISOString()
        })
      };
    } catch (err) {
      lastError = {
        status: 504,
        message: err.name === "AbortError" ? "Upstream Gemini request timed out." : err.message,
        model: modelName
      };
    }
  }

  return {
    statusCode: lastError?.status || 502,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: lastError?.message || "Unable to reach the Gemini intelligence core.",
      modelAttempted: lastError?.model || MODEL_FALLBACK_CHAIN[0]
    })
  };
};