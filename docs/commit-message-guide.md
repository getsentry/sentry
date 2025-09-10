# Commit Message Guide (Concise + Spec-Referenced)

Purpose: Define a minimal, consistent commit message style for OAuth 2.1 work (and adjacent features) that is easy to scan and links to authoritative specs.

## Goals
- Keep subjects short, imperative, and specific.
- Keep bodies brief (1–3 bullets or 1–2 short sentences).
- Include spec reference URLs in a dedicated Refs block.
- Avoid verbose changelogs or narrative commentary.

## Style
- Subject: Conventional Commits format, present tense, imperative, ≤72 chars.
  - Syntax: `<type>(<scope>): <subject>`
  - Common types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `build`, `ci`.
  - Scope: use the higher‑level module. For OAuth 2.1 work use `oauth`.
  - Put subcomponent details (e.g., token/authorize) in the subject text, not the scope.
- Body: 1–3 bullets or short sentences covering what changed and why.
- Refs: explicit URLs to relevant specs (OAuth 2.1 draft and specific RFC sections).
- Omit non-essential details; no stack traces, screenshots, or exhaustive rationale.

## Examples

Good (preferred — simple like #99004 but with spec refs):

Subject:
- feat(oauth): enforce exact redirect matching

Body:
- Require lexical equality; reject prefix matches when multiple URIs.

Refs:
- https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13
- https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3

Good (short like #82294 with spec refs):

Subject:
- feat(oauth): add client_secret_basic and RFC errors

Body:
- Prefer Basic over body; 401 invalid_client; ensure non-cacheable responses via Django `never_cache` (do not add `Pragma`).

Refs:
- https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13
- https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1
- https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
- https://datatracker.ietf.org/doc/html/rfc6749#section-5.1

Avoid (too verbose like #99003):
- Multi-paragraph bodies, extensive background, or mixed unrelated changes.

## Format Rules
- One blank line between subject and body.
- Include a `Refs:` block at the end with 1–5 URLs, one per line.
- Do not include issue/PR numbers in the subject. If needed, add them at the end of the body (optional): `Related: #99002`.
- Do not include co-author or changelog trailers unless explicitly required.

## Canned Prompt (for Codex to write a commit message)
Use this prompt verbatim, filling in the placeholders.

---
You are writing a single git commit message.
Follow these rules exactly:
- Subject: Conventional Commits style `<type>(<scope>): <subject>`, ≤72 chars, present tense, imperative.
- Allowed types: feat, fix, refactor, docs, chore, test, perf, build, ci.
- Scope: use `oauth` for this work. Put subcomponent details in the subject text.
- Body: max 3 bullets or 2 short sentences; focus on what and why.
- Include a `Refs:` block with spec URLs (OAuth 2.1 draft and relevant RFC sections).
- No extra sections, no co-authors, no changelog, no screenshots.

Inputs:
- Short summary: "${SUMMARY}" (one line)
- Key changes (bullets):
${KEY_CHANGES}
- Spec URLs (one per line):
${SPEC_URLS}

Output format:
<type>(<scope>): <subject>

<1–3 bullets or 1–2 sentences>

Refs:
<one URL per line>

Now generate the commit message.
---

## Example Inputs for the Canned Prompt
- SUMMARY: Add client_secret_basic and RFC error semantics for /oauth/token
- KEY_CHANGES:
  - Prefer Basic over body; reject both present (invalid_request).
  - 401 invalid_client with WWW-Authenticate; ensure non-cacheable responses via Django `never_cache` (do not add `Pragma`).
  - Standardize token_type to Bearer; ensure expires_in is integer.
- SPEC_URLS:
  - https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13
  - https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1
  - https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
  - https://datatracker.ietf.org/doc/html/rfc6749#section-5.1

## Reviewer Checklist (Optional)
- Subject is concise and action-oriented.
- Body is ≤3 bullets and explains rationale at a glance.
- Refs block contains correct URLs to specs.
- No unrelated changes are bundled in the commit.
