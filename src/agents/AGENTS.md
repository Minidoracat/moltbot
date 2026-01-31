# src/agents/ — Agent Runtime Core

Largest subsystem (435 files, 68k+ LOC). Owns agent execution, tools, sandbox, skills, and session management.

## Structure

```
agents/
├── pi-embedded-runner/     # Embedded Pi agent runtime (run loop, compaction, model quirks)
│   └── run/                # Run attempt logic (attempt, images, payloads, params)
├── pi-embedded-helpers/    # Pi utilities (prompt building, streaming)
├── pi-extensions/          # Pi extensions (context-pruning/)
├── cli-runner/             # CLI backend execution (Claude CLI, Codex CLI, Qwen CLI)
├── auth-profiles/          # OAuth/API key credential management + cooldown tracking
├── tools/                  # 59 agent tool implementations (browser, canvas, cron, sessions, nodes, etc.)
├── sandbox/                # Docker sandbox management (per-session containers, tool policy)
├── skills/                 # Skill system (workspace/bundled/managed skills, frontmatter parsing)
├── schema/                 # Tool schema utilities (Gemini cleanup, TypeBox helpers)
├── test-helpers/           # Test utilities
├── pi-tools.ts             # Main tool factory: createMoltbotCodingTools()
├── context.ts              # Context window inference from model metadata
├── model-catalog.ts        # Model alias resolution
└── bash-tools.exec.ts      # Bash tool exec implementation
```

## Key Entry Points

| Symbol | File | Role |
|--------|------|------|
| `runEmbeddedPiAgent()` | `pi-embedded-runner.ts` | Core embedded Pi run loop |
| `createMoltbotCodingTools()` | `pi-tools.ts` | Main tool factory (all agent runners use this) |
| `subscribeEmbeddedPiSession()` | `pi-embedded-runner.ts` | Streaming event subscription |
| `compactEmbeddedPiSession()` | `pi-embedded-runner.ts` | Session history compaction |
| `runCliAgent()` | `cli-runner.ts` | CLI-based agent runner |
| `buildAgentSystemPrompt()` | `pi-embedded-helpers/` | System prompt construction |
| `loadAuthProfileStore()` | `auth-profiles/store.ts` | Credential management |
| `buildWorkspaceSkillSnapshot()` | `skills/workspace.ts` | Skill loading + prompt building |

## Conventions (Unique to This Subsystem)

### Tool Policy System
Multi-layer filtering: profile > global > agent > group > sandbox > subagent.
- `resolveEffectiveToolPolicy()` — merges all policy layers
- `filterToolsByPolicy()` — enforces allowlist/denylist
- Plugin groups expand via `buildPluginToolGroups()`

### Tool Creation Pattern
All tools use factory functions returning `AnyAgentTool | null`:
```typescript
// tools/*.ts follow this pattern:
export function createBrowserTool(ctx: ToolContext): AnyAgentTool { ... }
// Sandbox-aware: return null if tool unavailable in sandbox context
```

### Model-Specific Quirks
- **Google/Gemini**: `cleanSchemaForGemini()`, `sanitizeGoogleTurnOrdering()` — schema/turn fixes
- **Anthropic OAuth**: Tool name remapping for Claude Code compatibility
- **OpenAI reasoning**: `extractThinkingFromTaggedText()` — thinking block promotion
- **Minimax**: `stripMinimaxToolCallXml()` — XML cleanup

### Session Keys
Format: `main`, `group:<id>`, `cron:<id>`, `hook:<id>`, `node:<id>`.
Session lanes (global/nested/subagent) control concurrency.

### Testing Exports
Use `export const __testing = { ... }` for test-only utilities (not public API).

## Anti-Patterns

- **Never bypass tool policy**: All tools must go through `filterToolsByPolicy()`.
- **Keep dynamic imports inside try/catch**: See `model-catalog.ts:61` — prevents crash on missing optional deps.
- **Don't create tools without context check**: Sandboxed tools must check `ctx.sandboxed` and return `null` when inappropriate.

## Where to Look

| Task | Location |
|------|----------|
| Add new agent tool | `tools/` — create `*-tool.ts`, register in `pi-tools.ts` |
| Fix model-specific bug | `pi-embedded-runner/google.ts`, `schema/clean-for-gemini.ts` |
| Change sandbox behavior | `sandbox/config.ts`, `sandbox/tool-policy.ts` |
| Add/modify skill | `skills/workspace.ts`, `skills/config.ts` |
| Auth profile issues | `auth-profiles/store.ts`, `auth-profiles/usage.ts` |
| Session compaction | `pi-embedded-runner/compact.ts` |
| Agent-to-agent comms | `tools/sessions-*.ts` |
