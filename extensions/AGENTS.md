# extensions/ — Plugin Architecture

28 workspace packages. Each is an independent plugin registered via `MoltbotPluginApi`.

## Plugin Types

| Type | Examples | Primary API |
|------|----------|-------------|
| **Channel** | msteams, matrix, zalo, bluebubbles | `api.registerChannel()` |
| **Tool** | voice-call, lobster, llm-task | `api.registerTool()` |
| **Memory** | memory-core, memory-lancedb | `api.registerTool()` + `api.registerService()` |
| **Auth** | google-antigravity-auth, copilot-proxy | `api.registerProvider()` |
| **Diagnostics** | diagnostics-otel | `api.registerService()` + `api.registerHook()` |

## Creating a New Extension

### Required Structure
```
extensions/<name>/
├── package.json          # Metadata + moltbot.extensions entry
├── index.ts              # Plugin entry (default export)
├── src/                  # Implementation
│   ├── channel.ts        # (channels) ChannelPlugin definition
│   ├── runtime.ts        # (tools) Runtime state management
│   ├── config.ts         # Config schema + validation
│   └── cli.ts            # CLI command registration (optional)
└── README.md
```

### package.json Convention
```jsonc
{
  "name": "@moltbot/<name>",
  "moltbot": {
    "extensions": ["./index.ts"],
    // Channel plugins add:
    "channel": {
      "id": "<name>",
      "label": "Display Name",
      "docsPath": "/channels/<name>",
      "order": 60,
      "aliases": ["alt-name"]
    },
    // Installable plugins add:
    "install": {
      "npmSpec": "@moltbot/<name>",
      "localPath": "extensions/<name>",
      "defaultChoice": "npm"
    }
  }
}
```

### Entry Point Pattern
```typescript
import type { MoltbotPluginApi } from "clawdbot/plugin-sdk";

const plugin = {
  id: "<name>",
  name: "Display Name",
  description: "...",
  configSchema: emptyPluginConfigSchema(), // or custom schema
  register(api: MoltbotPluginApi) {
    api.registerChannel({ plugin: myChannelPlugin });
    // or: api.registerTool((ctx) => createMyTool(api), { optional: true });
    // or: api.registerService({ id: "<name>", start, stop });
  },
};
export default plugin;
```

## Registration APIs

| Method | Use Case |
|--------|----------|
| `api.registerChannel()` | Add messaging channel |
| `api.registerTool()` | Add agent tool (factory: `ctx => Tool \| null`) |
| `api.registerGatewayMethod()` | Add WebSocket RPC method |
| `api.registerCli()` | Add CLI commands |
| `api.registerService()` | Add lifecycle service (start/stop) |
| `api.registerHook()` | Add event hooks |
| `api.registerHttpHandler()` | Add HTTP endpoints |
| `api.registerProvider()` | Add model provider auth |
| `api.registerCommand()` | Add chat commands (bypass LLM) |

## Dependency Rules

- **Runtime deps** -> `dependencies` (installed by `npm install --omit=dev`)
- **Core types** -> `devDependencies`: `"moltbot": "workspace:*"`
- **NEVER** put `workspace:*` in `dependencies` (breaks npm install in plugin dir)
- Import core types via `"clawdbot/plugin-sdk"` (jiti alias resolves at runtime)
- Plugin-only deps stay in extension `package.json`, NOT root

## Tool Registration

```typescript
api.registerTool(
  (ctx) => {
    if (ctx.sandboxed) return null; // Respect sandbox policy
    return createMyTool(api);
  },
  { optional: true }, // Requires explicit allowlist
);
```

Context object provides: `sandboxed`, `agentId`, `sessionKey`, workspace paths.

## Config Schema with UI Hints

```typescript
const configSchema = {
  parse: (raw: unknown) => schema.parse(raw),
  validate: (raw: unknown) => schema.safeParse(raw),
  jsonSchema: { /* JSON Schema */ },
  uiHints: {
    apiKey: { label: "API Key", sensitive: true, help: "..." },
    endpoint: { label: "Endpoint", placeholder: "https://..." },
  },
};
```

## Anti-Patterns

- **Don't add extension deps to root `package.json`** unless core uses them.
- **Don't use `workspace:*` in `dependencies`** — only in `devDependencies`/`peerDependencies`.
- **Don't skip sandbox checks** in tool factories.
- After adding a channel extension, review `.github/labeler.yml` for label coverage.
