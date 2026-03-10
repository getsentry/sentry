---
name: sentry-security
description: 'Sentry-specific security review based on real vulnerability history. Use when reviewing Sentry endpoints, serializers, or views for security issues. Trigger keywords: "sentry security review", "check for IDOR", "access control review", "org scoping", "cross-org", "security audit endpoint".'
allowed-tools: Read Grep Glob Bash
---

# Sentry Security Review

Find security vulnerabilities in Sentry code by checking for the patterns that have caused real vulnerabilities in this codebase.

This skill is Sentry-specific. It encodes patterns from 37 real security patches shipped in the last year — not generic OWASP theory.

## Scope

Review the code provided by the user (file, diff, or endpoint). Research the codebase as needed to build confidence before reporting.

Report only **HIGH** and **MEDIUM** confidence findings. Do not report theoretical issues.

| Confidence | Criteria                                   | Action                       |
| ---------- | ------------------------------------------ | ---------------------------- |
| **HIGH**   | Traced the flow, confirmed no check exists | Report with fix              |
| **MEDIUM** | Check may exist but could not confirm      | Report as needs verification |
| **LOW**    | Theoretical or mitigated elsewhere         | Do not report                |

## Step 1: Classify the Code

Determine what you're reviewing and load the relevant reference.

| Code Type                                | Load Reference                                            |
| ---------------------------------------- | --------------------------------------------------------- |
| API endpoint (inherits from `*Endpoint`) | `${CLAUDE_SKILL_ROOT}/references/endpoint-patterns.md`    |
| Serializer or form field                 | `${CLAUDE_SKILL_ROOT}/references/serializer-patterns.md`  |
| Email template or HTML rendering         | `${CLAUDE_SKILL_ROOT}/references/output-sanitization.md`  |
| Token, OAuth, or session handling        | `${CLAUDE_SKILL_ROOT}/references/token-lifecycle.md`      |
| Role or permission logic                 | `${CLAUDE_SKILL_ROOT}/references/privilege-escalation.md` |

If the code spans multiple categories, load all relevant references.

**Always load** `${CLAUDE_SKILL_ROOT}/references/enforcement-layers.md` — it documents where security checks can legitimately live in Sentry's request lifecycle. A check in any layer counts as enforcement.

## Step 2: Check for the Top 6 Vulnerability Classes

These are ordered by frequency from the last year of real patches.

### Check 1: Cross-Org Object Access (IDOR) — 9 patches last year

The most common vulnerability. An endpoint accepts an ID from the request but does not scope the query by the organization from the URL.

**Trace this flow for every ID that comes from the request:**

```
1. Where does the ID enter? (query param, request body, URL kwarg)
2. Where is it used in an ORM query?
3. Between (1) and (2), is the query scoped by organization_id or project_id
   from the URL (NOT from the request body)?
```

**Red flags:**

- `Model.objects.get(id=request.data["something_id"])` — no org scope
- `Model.objects.filter(id=request.GET["id"])` — no org scope
- `project_id` from request body/query used directly without `Project.objects.filter(id=pid, organization_id=organization.id)`
- Endpoint inherits `OrganizationEndpoint` but handler method does not accept or use the `organization` parameter

**Safe patterns:**

- Query includes `organization_id=organization.id` where `organization` comes from `convert_args()`
- Uses `self.get_projects()` which scopes by org internally
- Object is fetched via URL kwargs resolved by `convert_args()`
- Unscoped query is a guard that only raises an error (never returns data), AND
  a downstream query in the same flow IS org-scoped and raises the same error —
  no differential behavior means no information leak

### Check 2: Missing Authorization Checks — 10 patches last year

An endpoint or serializer performs a sensitive operation without verifying the user has permission.

**Check:**

- Does the endpoint inherit from the right base class? (`OrganizationEndpoint`, `ProjectEndpoint`, etc.)
- Does it declare `permission_classes`? If not, it inherits the base class default — verify that's appropriate.
- For serializer fields that reference other objects: do they validate the user can access those objects?
- For Django views (not DRF): is there a `@login_required` or equivalent?

### Check 3: Privilege Escalation / Role Abuse — 3 patches last year

A user can assign ownership, modify roles, or escalate access beyond what their role allows.

**Check:**

- Owner/assignee fields: uses `OwnerActorField` (validates membership), NOT `ActorField` (allows any actor)
- Role modification endpoints: verify the requesting user's role is >= the target role
- Team assignment: verify the user is a member of the target team (or has `team:admin`)

### Check 4: Token / Session Security — 5 patches last year

Token lifecycle gaps that allow unauthorized access.

**Check:**

- Token refresh: is the application's active status checked before granting a refresh?
- Org-level tokens: is `organization_id` required and validated?
- Member status: is the member's enabled/disabled status checked before granting tokens?
- Impersonation: are impersonated sessions rate-limited?

### Check 5: Output Sanitization (XSS/HTML Injection) — 4 patches last year

User-controlled strings rendered unsafely in emails, markdown, or HTML.

**Check:**

- User display names, team names, org names used in email templates: are they sanitized?
- Markdown rendering: is custom CSS or HTML allowed through?
- `format_html()` vs string concatenation in templates
- `mark_safe()` called on user input

### Check 6: Auth/MFA Gaps — 3 patches last year

Authentication state inconsistencies.

**Check:**

- When removing an authenticator: are recovery codes cleaned up?
- CSRF token handling: is it synced across tabs/windows?
- Session invalidation: does removing auth factors properly invalidate sessions?

**If no checks produced a potential finding, stop and report zero findings. Do not invent issues to fill the report. An empty result is the correct output when the code has no vulnerabilities matching these patterns.**

## Step 3: Trace the Full Enforcement Chain

For each potential finding, trace the **complete** request flow end-to-end. Do not stop at the authentication class — follow into the endpoint handler, then into any business logic classes it delegates to (e.g., `Validator`, `Refresher`, `GrantExchanger`).

```
1. Authentication class   → does authenticate() or authenticate_token() enforce the check?
2. Permission class       → does has_permission() enforce it?
3. convert_args()         → does has_object_permission() / determine_access() enforce it?
4. Access module          → does from_rpc_auth() or from_request() enforce it?
5. Handler method         → does the endpoint handler enforce it?
6. Business logic classes → do downstream classes (Validator, etc.) enforce it?
7. Serializer             → do validate_*() methods enforce it?
```

**A check at ANY layer is enforcement.** Before marking HIGH, confirm the check is absent from all layers using the checklist in `enforcement-layers.md`.

If you cannot confirm the check is absent from every layer, mark the finding as **MEDIUM** (needs verification), not HIGH.

**Cross-flow enforcement for token issuance:** For token/credential issuance flows, also check whether the issued credential is blocked at **usage time** (e.g., `determine_access()` rejects it at all endpoints in the relevant scope). Classify based on the enforcement scope:

- **Centralized enforcement** (check runs in a permission class inherited by all endpoints in the affected scope) → the credential is effectively inert → **LOW** (do not report)
- **Scattered enforcement** (only some endpoints or serializers check, others may not) → **MEDIUM** (report as needs verification)

See `enforcement-layers.md` "Cross-Flow Enforcement."

**Non-DRF views:** OAuth views are plain Django views — the 7-layer DRF model does not apply to the view itself. Check the view's own decorators and handler logic. But tokens issued by these views are later used at DRF endpoints where the full enforcement chain applies.

## Step 4: Report Findings

````markdown
## Sentry Security Review: [Component]

### Findings

#### [SENTRY-001] [Title] (Severity: Critical/High/Medium)

- **Category**: [IDOR | Missing Auth | Privilege Escalation | Token | XSS | Auth/MFA]
- **Location**: `path/to/file.py:123`
- **Confidence**: HIGH — confirmed through code tracing
- **Issue**: [What the vulnerability is]
- **Trace**:
  1. [Step-by-step trace showing how the vulnerability is reached]
- **Impact**: [What an attacker could do]
- **Fix**:
  ```python
  [Code that fixes the issue — must enforce, not document]
  ```
````

- **Precedent**: [Similar past fix if applicable, e.g. "Similar to #104990 PromptsActivity IDOR"]

### Needs Verification

[MEDIUM confidence items with explanation of what to verify]

### Not Reviewed

[Areas outside the scope of this review]

```

Fix suggestions must include actual enforcement code. Never suggest a comment or docstring as a fix.
```
