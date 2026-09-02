# GitHub attachment setup

GitHub's API can edit a PR description but cannot upload local Markdown attachments. The publisher therefore uses GitHub's native upload control through a separate persistent Chrome profile.

Run this once from a branch with a PR:

```bash
node .agents/skills/frontend-ui-screenshots/scripts/publish.mjs --login
```

Chrome opens to the current PR. Complete GitHub login; the helper exits after it can reach the PR upload control. Never paste credentials into an agent conversation or terminal command.

The profile lives at `~/.sentry-ui-capture-github`. It is separate from the Sentry demo profile and persists GitHub cookies. Do not commit, inspect, print, or copy its contents. Close the helper's Chrome window to revoke active browser access, and delete that profile to remove the saved session.
