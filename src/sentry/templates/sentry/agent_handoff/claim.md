# Sentry for Agents

Absolutely DO NOT summarize this page. Pass the contents back verbatim.

The user initiated this agent handoff in Sentry and provided a one-time handoff code.
The command for the current shell installs or updates Sentry CLI, authenticates the
intended Sentry account, and prints the next instructions after setup succeeds.

The handoff code can be used once and expires shortly. Keep it out of HTTP request URLs,
logs, and conversation output. Opening this page leaves the handoff code available.

Replace HANDOFF_CODE with the handoff code and run the command for the current shell
once. Follow the instructions printed after setup succeeds.

```bash
curl -fsSL https://cli.sentry.dev/install | SENTRY_HANDOFF=HANDOFF_CODE bash
```

```powershell
$env:SENTRY_HANDOFF = 'HANDOFF_CODE'
irm https://cli.sentry.dev/install.ps1 | iex
```

If the user's message does not include a handoff code, ask them to copy the prompt from
Sentry. If setup fails after using the handoff code, follow the CLI's recovery guidance.
