const { handler } = require("../netlify/functions/api.js");

module.exports = async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    const route = req.query?.route || parsedUrl.pathname.split("/").filter(Boolean).pop() || "";

    const event = {
      httpMethod: req.method,
      path: `/${route}`,
      headers: req.headers,
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}),
    };

    const result = await handler(event);

    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }

    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error("Vercel API Handler Error:", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Internal server error" });
  }
};
