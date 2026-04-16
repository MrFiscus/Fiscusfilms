const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const realtimeAuthState = {
  activeClients: 0,
  activeAuthOps: 0,
  watchlistAdds: 0,
  favoriteToggles: 0,
  signouts: 0,
  backdropUpdates: 0,
  lastEvent: "idle",
  lastUpdatedAt: new Date().toISOString()
};

function broadcastRealtimeAuthState() {
  realtimeAuthState.lastUpdatedAt = new Date().toISOString();
  io.emit("auth:state", realtimeAuthState);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API health check.
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "fiscusfilms-api", timestamp: new Date().toISOString() });
});

app.get("/api/realtime/auth-state", (req, res) => {
  res.json({ ok: true, state: realtimeAuthState });
});

app.get("/api/realtime/app-state", (req, res) => {
  res.json({ ok: true, state: realtimeAuthState });
});

// Generic TMDB proxy so frontend never exposes API keys.
app.get("/api/tmdb/*", async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, message: "TMDB_API_KEY is not configured on the server." });
  }

  const tmdbPath = String(req.params[0] || "").replace(/^\/+/, "");
  if (!tmdbPath) {
    return res.status(400).json({ ok: false, message: "Missing TMDB path." });
  }

  try {
    const queryParams = new URLSearchParams();
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || key === "") {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => queryParams.append(key, String(entry)));
        return;
      }

      queryParams.set(key, String(value));
    });

    queryParams.set("api_key", apiKey);

    const upstreamUrl = `https://api.themoviedb.org/3/${tmdbPath}?${queryParams.toString()}`;
    const upstream = await fetch(upstreamUrl);
    const rawBody = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.send(rawBody);
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Server error while querying TMDB.", error: error.message });
  }
});

// Serve frontend files from one public directory.
app.use(express.static(PUBLIC_DIR));

// Explicit routes for your multi-page app.
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "profile.html"));
});

app.get("/movies", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "movies.html"));
});

io.on("connection", (socket) => {
  realtimeAuthState.activeClients += 1;
  realtimeAuthState.lastEvent = "client_connected";
  broadcastRealtimeAuthState();

  socket.emit("auth:state", realtimeAuthState);

  socket.on("auth:event", (payload = {}) => {
    const eventType = String(payload.type || "unknown");

    if (eventType === "submit:start" || eventType === "oauth:start") {
      realtimeAuthState.activeAuthOps += 1;
    }

    if (eventType === "submit:error" || eventType === "submit:success" || eventType === "oauth:error" || eventType === "oauth:redirect") {
      realtimeAuthState.activeAuthOps = Math.max(0, realtimeAuthState.activeAuthOps - 1);
    }

    realtimeAuthState.lastEvent = eventType;
    broadcastRealtimeAuthState();

    io.emit("app:event", {
      type: `auth:${eventType}`,
      source: "auth",
      details: payload.details || {},
      at: new Date().toISOString()
    });
  });

  socket.on("app:event", (payload = {}) => {
    const eventType = String(payload.type || "unknown");

    if (eventType === "watchlist:add") {
      realtimeAuthState.watchlistAdds += 1;
    }

    if (eventType === "favorite:toggle") {
      realtimeAuthState.favoriteToggles += 1;
    }

    if (eventType === "auth:signout") {
      realtimeAuthState.signouts += 1;
    }

    if (eventType === "backdrop:update") {
      realtimeAuthState.backdropUpdates += 1;
    }

    realtimeAuthState.lastEvent = eventType;
    broadcastRealtimeAuthState();

    io.emit("app:event", {
      type: eventType,
      source: String(payload.source || "client"),
      details: payload.details || {},
      at: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {
    realtimeAuthState.activeClients = Math.max(0, realtimeAuthState.activeClients - 1);
    if (realtimeAuthState.activeAuthOps > 0) {
      realtimeAuthState.activeAuthOps -= 1;
    }
    realtimeAuthState.lastEvent = "client_disconnected";
    broadcastRealtimeAuthState();
  });
});

server.listen(PORT, () => {
  console.log(`FiscusFilms server running on http://localhost:${PORT}`);
});
