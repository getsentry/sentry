# OAuth 2.1 Compliance Checklist

Purpose: Verify Sentry’s OAuth implementation against OAuth 2.1 (draft) and related RFCs. Use the Implementation Checklists embedded in each component doc under `docs/oauth2.1/`.

Legend

- Status: Implemented | Partial | Missing | N/A | Unknown
- Evidence: code/test references
- Action: concrete remediation plan if not Implemented

Core Requirements (summary)

- RFC 6749 §3.1.2.3 — Redirect URI exact match. If multiple registered, require `redirect_uri` parameter.
- RFC 8252 §8.4 — Native apps loopback redirect: allow ephemeral ports when registered loopback URI omits port.
- OAuth 2.1 draft — Remove Implicit and Password grants; require PKCE for Authorization Code (esp. public clients); prefer `client_secret_basic`.
- RFC 7636 — PKCE S256 support and verification.
- RFC 8414 — Authorization Server Metadata (discovery).
- RFC 6750 — Bearer token usage and error challenges.

Evaluation Process

1. Use the Implementation Checklists in `docs/oauth2.1/*.md` to drive review. Track progress in PRs, and ensure tests accompany changes.
2. Subagents:
   - Code Auditor: confirm implementation and add code pointers.
   - Test Auditor: confirm automated tests exist and add test pointers.
   - Docs Auditor: confirm public/internal docs align; add links.
   - Security Auditor: confirm threat mitigations (state, PKCE, rotation, TLS-only).
3. Weekly triage: convert checklist items into tracked issues with owners (as needed).
