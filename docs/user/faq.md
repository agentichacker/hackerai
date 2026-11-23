# FAQ

## Is HackerAI a harness?

No. A harness is what turns an LLM into an agent: it gives the model tools, a way to call them, runs them, and hands the results back. Claude Code is kind of a harness. It is an interface (the TUI, the Code tab in the desktop app) plus a harness underneath (the Anthropic Agent SDK). Codex is the same split: the app plus the Codex App Server. HackerAI uses those harnesses. It is not a harness, and it does not work without one.

Chef = LLM. Kitchen = harness. HackerAI = the restaurant that lets you bring whatever kitchen you want. Our MCP is a cookbook we hand the kitchen, but the chef won't open it unless you tell them to :)

Bring your own: Claude Code, Codex, Cursor, Grok Build, OpenCode, Google Antigravity, Kiro, Pi, Muse Code, or fx. [Provider setup](./install.md#providers)

## Why use HackerAI instead of Claude Code or the Codex app?

We were inspired by the Codex desktop app, Conductor, Claude Desktop, and Cursor Glass, but none met our bar. What you get:

- Bring your own sub. Claude, Codex, and whatever else you already have installed.
- Best in class remote. Run `hackerai up` on any box and drive it from anywhere.
- Truly 100% open source. If we go the wrong direction, fork it.

Every harness feels nearly identical in here, so you can stop worrying about harnesses and focus on building :) [Install](./install.md)

## Can I use HackerAI with my Claude Code subscription?

Yes.

## How much does HackerAI cost?

Nothing. There's no way to pay us to use HackerAI. You bring your own sub. It is free and open source (MIT). You still pay your provider like you already do. HackerAI Connect is free too, for now. Every account can connect up to 3 machines running HackerAI. Phones and browsers that connect to them do not count. Need more? Link a paid HackerAI Chat account. [More machines](#can-i-connect-more-than-3-machines-with-hackerai-connect) We don't want to charge for this, but if the bill gets unacceptable we may have to change course. If you hit limits or have issues, you can always fork it, self host, or use Tailscale. [Install](./install.md)

## Can I connect more than 3 machines with HackerAI Connect?

Yes. Link your HackerAI Chat account and HackerAI Connect raises your limit: up to 10 machines with HackerAI Chat Pro, or 100 with Premier. Open your account menu in HackerAI, go to **HackerAI Chat**, and select **Link HackerAI Chat**. Sign in to HackerAI Chat and approve. The free HackerAI Chat plan keeps the normal limit of 3. [More machines with HackerAI Chat](./remote-access.md#more-machines-with-hackerai-chat)

## Why is my Claude 5-hour limit draining so fast?

It shouldn't anymore. HackerAI drives Claude through Anthropic's Agent SDK, and Anthropic's 5h meter used to charge Agent SDK usage about 1.7x more than using Claude Code directly. Weekly limits were never affected. Since v0.1.7, Claude in HackerAI drains your 5h limit at the same rate as Claude Code. Still seeing it? [Update HackerAI](./updating.md) on the machine that runs your agents.

## How do I use HackerAI remotely?

Your agents run wherever HackerAI runs: your desktop, a server, a VPS. You connect to it from anywhere. I do this constantly. Less than 5% of my prompts run on my laptop. Run `hackerai up` on that machine and you get really good remote support. HackerAI Connect is the easy path. LAN pairing and Tailscale work too, and [hackerai.sh](https://hackerai.sh) is the web client. [Remote access](./remote-access.md)

## Why does HackerAI Connect keep disconnecting?

HackerAI Connect is our built-in alternative to Tailscale for remote connections. If it keeps dropping, open **Settings > Environments**, find the machine, and select **Details**. The first part marked as failed is the cause. I will not be disappointed if you set up Tailscale as a fallback (I do this personally). [HackerAI Connect troubleshooting](./hackerai-connect-troubleshooting.md)

## Will I get banned for using my subscription?

No. We work with all of the labs and HackerAI is within the TOS of Claude Code, Codex, and Google Antigravity. We worked directly with [SpaceXAI](https://x.com/SpaceXSI/status/2070195830192320600) to collaborate on the Grok Build and Cursor integrations. Everything else uses official ACP bindings.

If it works in HackerAI, you can trust it is safe.

## Can I add a bunch of accounts for one provider?

I don't think HackerAI is the right place to manage a pile of accounts. If we add an auto-switcher, we are risking TOS bans for our users.

A separate work account is fine. Setup for two: [Codex](./providers-codex.md#use-multiple-accounts) · [Claude](./providers-claude.md#separate-accounts-or-configurations). For a bigger pool, manage them outside HackerAI with a self-hosted proxy like [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI). After you set up a hub, HackerAI can show its pooled limits under Usage. [Connect a hub](./usage.md#connect-a-cliproxyapi-hub)

## Can I use an API key or OpenRouter instead of a subscription?

Yes. Add another provider instance in Settings and give it its own keys and endpoint. Claude has a full OpenRouter recipe. Your subscription setup stays untouched. [OpenRouter](./providers-claude.md#openrouter) · [Provider instances](./install.md#providers)

## Does HackerAI support local models?

No. HackerAI is a serious developer tool. Locally runnable models are not capable of meaningful engineering work.

## Does my code go to HackerAI servers?

No. Your code and prompts go from your machine to your provider (Anthropic, OpenAI, etc.), not to us. With HackerAI Connect, traffic rides a Cloudflare tunnel (`cloudflared` on your machine). Our relay sets up the link. It does not proxy your HTTP or WebSocket sessions. HackerAI does send basic product usage events (provider, model, token totals, that kind of thing). No prompts, no file contents. That is the same on Tailscale, LAN, or HackerAI Connect. Set `HACKERAI_TELEMETRY_ENABLED=false` if you want it off. [Product usage data](./telemetry.md)

## Worktrees are eating my disk. How do I clean them up?

Open **Settings → Worktrees → Cleanup** and turn on automatic worktree cleanup. You can also run it now from there. Worktrees add up fast. One user cleared 500 GB. [Storage cleanup](./project-settings.md#storage-cleanup)

## Is there voice input?

Yes. On iPhone and Android, dictation uses on-device speech by default, with the option to use a paired environment. On macOS 26 or later, desktop users can choose Apple Speech directly under **On this Mac** or choose an environment. Web and other desktop users can enable dictation by choosing an environment. The transcript goes into your draft for review. See [Voice input](./voice-input.md).

## Does it work on Windows, Mac, and Linux?

Yes, all three. Desktop app, CLI, the works. One catch: there is no `hackerai` binary for Intel Macs, so use the desktop app there. Windows folks can also run agents inside WSL. [Install](./install.md)

## Why is my provider not showing up?

Almost always, the CLI is not installed or not on the `PATH` of the machine that runs the server. (Not your phone. The computer.) Log in on that machine first, like `codex login` or `claude auth login`. Still missing? Point **Binary path** at it in provider settings. Version managers love to cause this one. [Provider setup](./install.md#providers)
