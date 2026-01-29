import { describe, expect, test } from "vitest";

import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentRoute } from "./resolve-route.js";

describe("resolveAgentRoute", () => {
  test("defaults to main/default when no bindings exist", () => {
    const cfg: OpenClawConfig = {};
    const route = resolveAgentRoute({
      cfg,
      channel: "whatsapp",
      accountId: null,
      peer: { kind: "dm", id: "+15551234567" },
    });
    expect(route.agentId).toBe("main");
    expect(route.accountId).toBe("default");
    expect(route.sessionKey).toBe("agent:main:main");
    expect(route.matchedBy).toBe("default");
  });

  test("dmScope=per-peer isolates DM sessions by sender id", () => {
    const cfg: OpenClawConfig = {
      session: { dmScope: "per-peer" },
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "whatsapp",
      accountId: null,
      peer: { kind: "dm", id: "+15551234567" },
    });
    expect(route.sessionKey).toBe("agent:main:dm:+15551234567");
  });

  test("dmScope=per-channel-peer isolates DM sessions per channel and sender", () => {
    const cfg: OpenClawConfig = {
      session: { dmScope: "per-channel-peer" },
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "whatsapp",
      accountId: null,
      peer: { kind: "dm", id: "+15551234567" },
    });
    expect(route.sessionKey).toBe("agent:main:whatsapp:dm:+15551234567");
  });

  test("identityLinks collapses per-peer DM sessions across providers", () => {
    const cfg: OpenClawConfig = {
      session: {
        dmScope: "per-peer",
        identityLinks: {
          alice: ["telegram:111111111", "discord:222222222222222222"],
        },
      },
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "telegram",
      accountId: null,
      peer: { kind: "dm", id: "111111111" },
    });
    expect(route.sessionKey).toBe("agent:main:dm:alice");
  });

  test("identityLinks applies to per-channel-peer DM sessions", () => {
    const cfg: OpenClawConfig = {
      session: {
        dmScope: "per-channel-peer",
        identityLinks: {
          alice: ["telegram:111111111", "discord:222222222222222222"],
        },
      },
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      accountId: null,
      peer: { kind: "dm", id: "222222222222222222" },
    });
    expect(route.sessionKey).toBe("agent:main:discord:dm:alice");
  });

  test("peer binding wins over account binding", () => {
    const cfg: OpenClawConfig = {
      bindings: [
        {
          agentId: "a",
          match: {
            channel: "whatsapp",
            accountId: "biz",
            peer: { kind: "dm", id: "+1000" },
          },
        },
        {
          agentId: "b",
          match: { channel: "whatsapp", accountId: "biz" },
        },
      ],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "whatsapp",
      accountId: "biz",
      peer: { kind: "dm", id: "+1000" },
    });
    expect(route.agentId).toBe("a");
    expect(route.sessionKey).toBe("agent:a:main");
    expect(route.matchedBy).toBe("binding.peer");
  });

  test("discord channel peer binding wins over guild binding", () => {
    const cfg: OpenClawConfig = {
      bindings: [
        {
          agentId: "chan",
          match: {
            channel: "discord",
            accountId: "default",
            peer: { kind: "channel", id: "c1" },
          },
        },
        {
          agentId: "guild",
          match: {
            channel: "discord",
            accountId: "default",
            guildId: "g1",
          },
        },
      ],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      accountId: "default",
      peer: { kind: "channel", id: "c1" },
      guildId: "g1",
    });
    expect(route.agentId).toBe("chan");
    expect(route.sessionKey).toBe("agent:chan:discord:channel:c1");
    expect(route.matchedBy).toBe("binding.peer");
  });

  test("guild binding wins over account binding when peer not bound", () => {
    const cfg: OpenClawConfig = {
      bindings: [
        {
          agentId: "guild",
          match: {
            channel: "discord",
            accountId: "default",
            guildId: "g1",
          },
        },
        {
          agentId: "acct",
          match: { channel: "discord", accountId: "default" },
        },
      ],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      accountId: "default",
      peer: { kind: "channel", id: "c1" },
      guildId: "g1",
    });
    expect(route.agentId).toBe("guild");
    expect(route.matchedBy).toBe("binding.guild");
  });

  test("missing accountId in binding matches default account only", () => {
    const cfg: OpenClawConfig = {
      bindings: [{ agentId: "defaultAcct", match: { channel: "whatsapp" } }],
    };

    const defaultRoute = resolveAgentRoute({
      cfg,
      channel: "whatsapp",
      accountId: undefined,
      peer: { kind: "dm", id: "+1000" },
    });
    expect(defaultRoute.agentId).toBe("defaultacct");
    expect(defaultRoute.matchedBy).toBe("binding.account");

    const otherRoute = resolveAgentRoute({
      cfg,
      channel: "whatsapp",
      accountId: "biz",
      peer: { kind: "dm", id: "+1000" },
    });
    expect(otherRoute.agentId).toBe("main");
  });

  test("accountId=* matches any account as a channel fallback", () => {
    const cfg: OpenClawConfig = {
      bindings: [
        {
          agentId: "any",
          match: { channel: "whatsapp", accountId: "*" },
        },
      ],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "whatsapp",
      accountId: "biz",
      peer: { kind: "dm", id: "+1000" },
    });
    expect(route.agentId).toBe("any");
    expect(route.matchedBy).toBe("binding.channel");
  });

  test("defaultAgentId is used when no binding matches", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [{ id: "home", default: true, workspace: "~/openclaw-home" }],
      },
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "whatsapp",
      accountId: "biz",
      peer: { kind: "dm", id: "+1000" },
    });
    expect(route.agentId).toBe("home");
    expect(route.sessionKey).toBe("agent:home:main");
  });
});

test("dmScope=per-account-channel-peer isolates DM sessions per account, channel and sender", () => {
  const cfg: OpenClawConfig = {
    session: { dmScope: "per-account-channel-peer" },
  };
  const route = resolveAgentRoute({
    cfg,
    channel: "telegram",
    accountId: "tasks",
    peer: { kind: "dm", id: "7550356539" },
  });
  expect(route.sessionKey).toBe("agent:main:telegram:tasks:dm:7550356539");
});

test("dmScope=per-account-channel-peer uses default accountId when not provided", () => {
  const cfg: OpenClawConfig = {
    session: { dmScope: "per-account-channel-peer" },
  };
  const route = resolveAgentRoute({
    cfg,
    channel: "telegram",
    accountId: null,
    peer: { kind: "dm", id: "7550356539" },
  });
  expect(route.sessionKey).toBe("agent:main:telegram:default:dm:7550356539");
});

describe("role-based agent routing", () => {
  test("guild+roles binding matches when member has matching role", () => {
    const cfg: MoltbotConfig = {
      bindings: [{ agentId: "opus", match: { channel: "discord", guildId: "g1", roles: ["r1"] } }],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      guildId: "g1",
      memberRoleIds: ["r1"],
      peer: { kind: "channel", id: "c1" },
    });
    expect(route.agentId).toBe("opus");
    expect(route.matchedBy).toBe("binding.guild+roles");
  });

  test("guild+roles binding skipped when no matching role", () => {
    const cfg: MoltbotConfig = {
      bindings: [{ agentId: "opus", match: { channel: "discord", guildId: "g1", roles: ["r1"] } }],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      guildId: "g1",
      memberRoleIds: ["r2"],
      peer: { kind: "channel", id: "c1" },
    });
    expect(route.agentId).toBe("main");
    expect(route.matchedBy).toBe("default");
  });

  test("guild+roles is more specific than guild-only", () => {
    const cfg: MoltbotConfig = {
      bindings: [
        { agentId: "opus", match: { channel: "discord", guildId: "g1", roles: ["r1"] } },
        { agentId: "sonnet", match: { channel: "discord", guildId: "g1" } },
      ],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      guildId: "g1",
      memberRoleIds: ["r1"],
      peer: { kind: "channel", id: "c1" },
    });
    expect(route.agentId).toBe("opus");
    expect(route.matchedBy).toBe("binding.guild+roles");
  });

  test("peer binding still beats guild+roles", () => {
    const cfg: MoltbotConfig = {
      bindings: [
        {
          agentId: "peer-agent",
          match: { channel: "discord", peer: { kind: "channel", id: "c1" } },
        },
        { agentId: "roles-agent", match: { channel: "discord", guildId: "g1", roles: ["r1"] } },
      ],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      guildId: "g1",
      memberRoleIds: ["r1"],
      peer: { kind: "channel", id: "c1" },
    });
    expect(route.agentId).toBe("peer-agent");
    expect(route.matchedBy).toBe("binding.peer");
  });

  test("no memberRoleIds → guild+roles doesn't match", () => {
    const cfg: MoltbotConfig = {
      bindings: [{ agentId: "opus", match: { channel: "discord", guildId: "g1", roles: ["r1"] } }],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      guildId: "g1",
      peer: { kind: "channel", id: "c1" },
    });
    expect(route.agentId).toBe("main");
    expect(route.matchedBy).toBe("default");
  });

  test("first matching binding wins with multiple role bindings", () => {
    const cfg: MoltbotConfig = {
      bindings: [
        { agentId: "opus", match: { channel: "discord", guildId: "g1", roles: ["r1"] } },
        { agentId: "sonnet", match: { channel: "discord", guildId: "g1", roles: ["r2"] } },
      ],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      guildId: "g1",
      memberRoleIds: ["r1", "r2"],
      peer: { kind: "channel", id: "c1" },
    });
    expect(route.agentId).toBe("opus");
    expect(route.matchedBy).toBe("binding.guild+roles");
  });

  test("empty roles array treated as no role restriction", () => {
    const cfg: MoltbotConfig = {
      bindings: [{ agentId: "opus", match: { channel: "discord", guildId: "g1", roles: [] } }],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      guildId: "g1",
      memberRoleIds: ["r1"],
      peer: { kind: "channel", id: "c1" },
    });
    expect(route.agentId).toBe("opus");
    expect(route.matchedBy).toBe("binding.guild");
  });

  test("CRITICAL: guild+roles binding NOT matched as guild-only when roles don't match", () => {
    const cfg: MoltbotConfig = {
      bindings: [
        { agentId: "opus", match: { channel: "discord", guildId: "g1", roles: ["admin"] } },
      ],
    };
    const route = resolveAgentRoute({
      cfg,
      channel: "discord",
      guildId: "g1",
      memberRoleIds: ["regular"],
      peer: { kind: "channel", id: "c1" },
    });
    expect(route.agentId).toBe("main");
    expect(route.matchedBy).toBe("default");
  });
});
