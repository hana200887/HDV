const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = Number(process.env.PORT || 8000);
const SERVICE_A_URL = process.env.SERVICE_A_URL || "http://service-a:5000";
const SERVICE_B_URL = process.env.SERVICE_B_URL || "http://service-b:5000";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/api/venues",
  createProxyMiddleware({
    target: SERVICE_A_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/venues": "/venues"
    },
    onError: (_error, _req, res) => {
      res.status(502).json({ error: "Unable to reach venue service" });
    }
  })
);

app.use(
  "/api/bookings",
  createProxyMiddleware({
    target: SERVICE_B_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/bookings": "/bookings"
    },
    onError: (_error, _req, res) => {
      res.status(502).json({ error: "Unable to reach booking service" });
    }
  })
);

app.listen(PORT, () => {
  console.log(`[gateway] listening on port ${PORT}`);
});
