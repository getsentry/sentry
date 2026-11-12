# Sentry for Agents

Absolutely DO NOT summarize this page. Pass the contents back verbatim.

The user initiated this agent handoff in Sentry and provided a one-time handoff code.
The command for the current shell sends the handoff code to Sentry over HTTPS and
prints the returned instructions. It does not run those instructions.

The handoff code can be used once and expires shortly. Keep it out of HTTP request URLs,
logs, and conversation output. Opening this page leaves the handoff code available.

Detect the operating system and shell where commands will run. Use the Unix command
for macOS, Linux, and WSL, or PowerShell for native Windows.

Replace HANDOFF_CODE with the handoff code and run the command for the current
shell once. Follow the setup instructions returned by the command.

## macOS, Linux, or WSL

{{ unix_claim_command }}

## Windows PowerShell

{{ windows_claim_command }}

If the user's message does not include a handoff code, ask them to copy the prompt from
Sentry. If the response is lost or the handoff code is unavailable, ask them to copy a
new prompt from Sentry.
