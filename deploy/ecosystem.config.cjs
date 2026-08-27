module.exports = {
  apps: [
    {
      name: "codex-canvas-web",
      script: "./src/web-canvas-server.mjs",
      cwd: __dirname + "/..",
      env: { CODEX_CANVAS_RUNTIME: "web", CODEX_CANVAS_REMOTE_MODE: "1" }
    },
    {
      name: "codex-canvas-mcp",
      script: "./web-mcp/server.mjs",
      cwd: __dirname + "/..",
      env: { CODEX_CANVAS_RUNTIME: "web", CODEX_CANVAS_REMOTE_MODE: "1" }
    }
  ]
};
