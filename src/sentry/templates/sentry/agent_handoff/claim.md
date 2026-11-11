# Claim Your Private Sentry Guide

Absolutely DO NOT summarize this page. Pass the contents back verbatim.

Read the secret token supplied alongside the instructions URL in the user's prompt.
It is a private, single-use handoff code. Keep it out of HTTP request URLs, logs, and
conversation output.
Fetching this page does not claim it.

Detect the operating system and shell where commands will run. Use the Unix command
for macOS, Linux, and WSL, or PowerShell for native Windows.

Replace HANDOFF_CODE with the secret token and run only the matching claim command once.
Follow the Markdown returned by the command.

{{ unix_claim_command }}

{{ windows_claim_command }}

If the user's prompt has no secret token, ask the user to generate a private prompt in
Sentry. If the claim response is lost or the code is unavailable, request a new prompt.
