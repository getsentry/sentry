# Claim Your Private Sentry Guide

Read the secret token supplied alongside the instructions URL in the user's prompt.
It is a private, single-use handoff code. Keep it out of HTTP request URLs, logs, and
conversation output.
Fetching this page does not claim it.

Replace HANDOFF_CODE with that token and run this explicit claim command. Follow
the Markdown returned by the command:

{{ claim_command }}

If the user's prompt has no secret token, ask the user to generate a private prompt in
Sentry. If the claim response is lost or the code is unavailable, request a new prompt.
