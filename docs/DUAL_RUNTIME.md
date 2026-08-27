# Codex-Canvas dual runtime (Codex local + ChatGPT web)

This build keeps the existing local Codex plugin unchanged and adds a separate remote MCP runtime for ChatGPT web.

## Runtime A — Codex local (existing behavior)

- MCP transport: stdio
- Config: `.mcp.json` and `.codex/config.toml`
- Server: `src/mcp-server.mjs`
- Keeps local-only features such as `projectDir`, Codex thread binding, `collect_recent_images`, `send_to_chat`, and the local Codex/ImageGen runner.

Run normally:

```bash
npm install
npm start
```

## Runtime B — ChatGPT web / cloud Codex

- MCP transport: Streamable HTTP
- MCP endpoint behind Nginx: `https://canvas.websyc.tech/mcp`
- MCP server: `web-mcp/server.mjs`
- Full browser UI/API server: `src/web-canvas-server.mjs`
- Server-side image provider: OpenAI Images API (`gpt-image-2` by default)
- Server-side text provider: OpenAI Responses API (`gpt-5.6-luna` by default)
- Storage: one persistent server-backed project directory in V1.

### Install

```bash
npm install
npm install --prefix web-mcp
cp .env.web.example .env.web
# load the env values with your process manager / shell
npm run start:web
```

For production, PM2 is recommended:

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

The web UI listens internally on `127.0.0.1:43217` and MCP on `127.0.0.1:8787` by default. Use `deploy/nginx-canvas.websyc.tech.conf` to route the public domain.

### Health check

```bash
curl https://canvas.websyc.tech/mcp-health
```

### ChatGPT custom app

Use this MCP endpoint:

```text
https://canvas.websyc.tech/mcp
```

Scan tools. The web runtime intentionally exposes web-safe tools only:

- `open_canvas`
- `canvas_status`
- `search_canvas`
- `prompt_history`
- `version_groups`
- `add_image`
- `generate_image`
- `edit_image`
- `generate_text`

Local filesystem/thread tools are intentionally absent from the remote server.

## Why there are two transports

A remote ChatGPT session cannot access `/Users/...`, `~/.codex/generated_images`, or a local Codex thread. The shared product is the Canvas data model and UI, while each runtime uses the correct environment-specific integration.

## Optional: point Codex at the cloud MCP

See `.codex/config.remote.toml.example`. This gives Codex and ChatGPT the same cloud canvas state, but local-only features such as `send_to_chat` and directory collection are not available through the cloud endpoint.

## Security notes

`CODEX_CANVAS_WEB_PROJECT_DIR` is single-tenant in this V1. Do not expose the domain to untrusted users without adding authentication at the gateway/MCP layer. The MCP endpoint supports an optional bearer token via `CODEX_CANVAS_MCP_TOKEN`; the browser UI itself should be protected by your existing login, reverse-proxy access policy, or equivalent when exposed publicly. The remote web server disables app update, shutdown, and project registry administration endpoints.

For multi-user production, replace the single project directory with an authenticated user/workspace mapping before public rollout.


## Dependency layout

The original Codex package remains on the root `package-lock.json`. The remote MCP SDK is intentionally isolated under `web-mcp/` so adding ChatGPT support does not change the local Codex dependency lock. Install both layers on the server:

```bash
npm ci
npm install --prefix web-mcp
```

The source archive was built without vendored `node_modules`; both commands require npm registry access on the deployment machine.
