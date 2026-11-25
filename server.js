const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Deriv WS Proxy OK");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (clientWs, req) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const appId = urlObj.searchParams.get("app_id") || "351IXYsDOWMrFUPXIWRvN";

  const derivUrl = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`;
  const derivWs = new WebSocket(derivUrl);

  const queue = [];
  let derivReady = false;

  derivWs.on("open", () => {
    derivReady = true;
    while (queue.length > 0 && derivWs.readyState === WebSocket.OPEN) {
      derivWs.send(queue.shift());
    }
  });

  derivWs.on("message", (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  });

  clientWs.on("message", (msg) => {
    const text = msg.toString();
    if (derivReady && derivWs.readyState === WebSocket.OPEN) {
      derivWs.send(text);
    } else {
      queue.push(text);
    }
  });

  const closeBoth = (code, reason) => {
    if (derivWs.readyState === WebSocket.OPEN || derivWs.readyState === WebSocket.CONNECTING) {
      derivWs.close();
    }
    if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
      try {
        clientWs.close(code || 1000, reason || "");
      } catch (_) {
        clientWs.terminate();
      }
    }
  };

  derivWs.on("close", () => closeBoth(1000, "Deriv closed"));
  derivWs.on("error", () => closeBoth(1011, "Deriv WS error"));
  clientWs.on("close", () => closeBoth());
  clientWs.on("error", () => closeBoth());
});

server.listen(PORT, () => {
  console.log(`Proxy rodando na porta ${PORT}`);
});
