# src/gateway/ — WebSocket Control Plane

187 files. Single WebSocket server that all clients (macOS app, iOS/Android nodes, CLI, WebChat, Control UI) connect to.

## Structure

```
gateway/
├── server.ts               # Public export (re-exports from server.impl.ts)
├── server.impl.ts          # Bootstrap + lifecycle orchestration (~586 LOC)
├── server/                 # WebSocket server internals
│   ├── ws-connection.ts    # Client connection handler
│   └── ws-connection/      # Message handling, auth, subscriptions
├── server-methods/         # RPC method implementations (33 files)
│   ├── sessions.*.ts       # Session CRUD, history, compact
│   ├── channels.*.ts       # Channel status, login, config
│   ├── agent.*.ts          # Agent run, cancel, subscribe
│   ├── config.*.ts         # Config get/set/patch
│   ├── nodes.*.ts          # Node list, invoke, describe
│   └── gateway.*.ts        # Gateway status, restart, health
├── protocol/               # Protocol schema definitions (TypeBox)
│   ├── methods.ts          # All WS method schemas
│   └── types.ts            # Shared protocol types
├── gateway-models.*.ts     # Model provider management + profiles
├── gateway-channels.*.ts   # Channel lifecycle (start/stop/probe)
├── gateway-agent.*.ts      # Agent session management
├── gateway-plugins.*.ts    # Plugin loading + lifecycle
└── gateway-health.*.ts     # Health checks + diagnostics
```

## Key Patterns

### RPC Methods
All in `server-methods/`. Each file exports a handler registered via `registerMethod()`:
```typescript
// server-methods/sessions.list.ts
export function registerSessionsList(ctx: GatewayMethodContext) {
  ctx.registerMethod("sessions.list", async ({ params, respond }) => {
    // ...
    respond(true, { sessions });
  });
}
```

Naming: `<domain>.<action>.ts` (e.g., `sessions.list.ts`, `channels.status.ts`, `agent.run.ts`).

### Protocol Schema
TypeBox schemas in `protocol/`. Changes require `pnpm protocol:gen` + `pnpm protocol:gen:swift` to sync Swift types.
Run `pnpm protocol:check` to validate generated files are up-to-date.

### Gateway Lifecycle
`server.impl.ts` orchestrates startup:
1. Create HTTP server (Hono)
2. Attach WebSocket upgrade handler
3. Start channels (monitors)
4. Load plugins
5. Start services (cron, health, Tailscale)
6. Bind to port

### Client Authentication
- **Loopback**: No auth required (default `--bind loopback`)
- **Tailscale Serve**: Identity headers from Tailscale
- **Password**: Shared password for Funnel/remote access
- **Token**: Bearer token auth

### Device Pairing
Devices (iOS/Android/macOS nodes) use Ed25519 keypair auth:
1. Device generates keypair on first launch
2. Connect request includes `{ deviceId, publicKey, signature, nonce }`
3. Server verifies signature, checks pairing store
4. Unpaired devices enter pairing flow; operator approves via `device.pair.approve`
5. Approved devices receive a token for future connections

### Authorization Scopes
Two client roles: `operator` (control) and `node` (device).
Methods grouped by scope: `operator.read`, `operator.write`, `operator.admin`, `operator.approvals`, `operator.pairing`.
Node-role methods: `node.invoke.result`, `node.event`, `skills.bins`.

### Conventions
- **Idempotency**: Mutating methods accept `idempotencyKey`; results cached in `context.dedupe` (Map with TTL)
- **Async ack**: Respond immediately with `{ status: "accepted" }`, then send final response when work completes
- **Broadcast opts**: `{ dropIfSlow: true }` for non-critical events
- **Hot reload**: Config changes trigger `applyHotReload()` (channels, hooks, cron) or `requestGatewayRestart()` (breaking changes)

## Where to Look

| Task | Location |
|------|----------|
| Add RPC method | `server-methods/` — create `<domain>.<action>.ts`, register in `server.impl.ts` |
| Change protocol schema | `protocol/methods.ts` or `protocol/types.ts`, then `pnpm protocol:gen` |
| Fix channel lifecycle | `gateway-channels.*.ts` |
| Model/provider issues | `gateway-models.*.ts` |
| Health check changes | `gateway-health.*.ts` |
| Plugin loading | `gateway-plugins.*.ts` |
| WebSocket connection | `server/ws-connection.ts` |

## Anti-Patterns

- **Never bind to non-loopback without auth**: Funnel requires `gateway.auth.mode: "password"`.
- **Always run `pnpm protocol:check`** after changing protocol schemas.
- **Don't add RPC methods outside `server-methods/`** — keep them colocated.
