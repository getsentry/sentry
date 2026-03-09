# Seer Configuration API — v3 Frontend-Optimized Design

Host: https://sentry.io/api/0

**Authors.**

@ryan953

**Status:** DRAFT — Planning document. References existing APIs from commit `2f5687c88269f923afce64e16366040398260b9d`.

---

## Design Goals

This document describes a set of new, Seer-namespaced API endpoints designed for the Sentry frontend. The existing APIs (documented in `api_v2.md`) were built incrementally and have several ergonomic issues for frontend consumption:

1. **No pagination on list endpoints** — `GET /organizations/{org}/autofix/automation-settings/` returns an unbound list.
2. **No individual-item updates** — updating a single project's settings requires a bulk endpoint with a list of one.
3. **Mixed concerns** — repository settings are either embedded in the repo object via `expand=settings` or handled by a sibling endpoint (`/repos/settings/`), rather than as a proper sub-resource.
4. **Inconsistent bulk vs. singular APIs** — no clear REST resource hierarchy.
5. **Scattered namespacing** — Seer settings are spread across `/autofix/`, `/repos/`, `/projects/`, and `/seer/` prefixes.

**Design principles for v3:**

- All Seer-specific endpoints live under `/organizations/{org}/seer/` or `/projects/{org}/{project}/seer/`.
- Every list endpoint supports **cursor-based pagination**, **sorting**, and **filtering**.
- Every item in a list has a corresponding **individual resource endpoint** (`GET`, `PUT`).
- Every list endpoint has a **bulk update** operation (`PUT` on the collection).
- Sub-resources (e.g., a project's repos) are served from **their own endpoints**, never embedded by default.
- Responses use **camelCase** field names consistently.

---

## Common Conventions

### Pagination

All list endpoints return cursor-based pagination via the `Link` response header (RFC 5988). Requests accept:

| Parameter | Type   | Default | Description                                            |
| --------- | ------ | ------- | ------------------------------------------------------ |
| cursor    | string | —       | Opaque cursor from the previous response's Link header |
| per_page  | int    | 25      | Number of results per page (max: 100)                  |

Response `Link` header example:

```
Link: <https://sentry.io/api/0/...?cursor=0:25:0>; rel="next"; results="true",
      <https://sentry.io/api/0/...?cursor=0:0:1>; rel="previous"; results="false"
```

### Sorting

List endpoints accept a `sortBy` parameter. Prefix with `-` for descending order.

Example: `?sortBy=-name` sorts by name descending.

### Filtering

List endpoints accept a `query` parameter for text search. Additional type-specific filter parameters are documented per endpoint.

### Bulk Updates

`PUT` on a collection accepts a **target selector** — a search query — plus the fields to update. `query` must be provided.

| Field | Type   | Description                                                                         |
| ----- | ------ | ----------------------------------------------------------------------------------- |
| query | string | Search query string (same syntax as the `GET` endpoint). Updates all matched items. |

Returns the updated resources in the same paginated format as `GET`.

---

## Resource: Seer Projects

Seer-scoped view of organization projects and their automation settings. The agent selection (`agent` field) encapsulates both whether automation is enabled and which agent handles it — eliminating the need to expose internal tuning values like `autofixAutomationTuning`.

**Replaces:**

- `GET /organizations/{org}/autofix/automation-settings/` (no pagination, no individual GET/PUT)
- `POST /organizations/{org}/autofix/automation-settings/` (bulk-only, no individual update)
- `GET/PUT /projects/{org}/{project}/` (general endpoint; Seer fields were side effects)

---

### List Projects [GET /organizations/{org}/seer/projects/]

Returns a paginated list of projects with their Seer automation settings.

- Endpoint: `OrganizationSeerProjectsEndpoint`
- Silo: Region

**Query Parameters**

| Parameter | Type   | Description                                                        |
| --------- | ------ | ------------------------------------------------------------------ |
| query     | string | Structured search string. See supported tokens below.              |
| sortBy    | string | Sort field. One of: `name`, `agent`, `reposCount`. Default: `name` |

**Search Query Syntax**

The `query` parameter accepts a space-separated list of `token:value` pairs. Bare words (no token prefix) match against project name and slug as a case-insensitive contains search.

**Comparison operators**

| Operator | Meaning               | Example           |
| -------- | --------------------- | ----------------- |
| `:`      | Equals                | `name:my-project` |
| `!:`     | Not equals            | `agent!:cursor`   |
| `>:`     | Greater than          | `reposCount>:0`   |
| `<:`     | Less than             | `reposCount<:5`   |
| `>=:`    | Greater than or equal | `reposCount>=:1`  |
| `<=:`    | Less than or equal    | `reposCount<=:10` |

**Supported tokens**

| Token            | Value type | Description                                                                        |
| ---------------- | ---------- | ---------------------------------------------------------------------------------- |
| `name`           | string     | Project name or slug (case-insensitive contains)                                   |
| `reposCount`     | int        | Number of repos configured for the project. Supports `>:`, `<:`, `>=:`, `<=:`, `:` |
| `agent`          | string     | Which agent handles automation. One of: `seer`, `cursor`, `claude`, `none`         |
| `create_pr`      | boolean    | Whether the agent auto-creates a PR. One of: `true`, `false`                       |
| `stopping_point` | string     | `automatedRunStoppingPoint`. One of: `code_changes`, `open_pr`                     |

**Examples**

```
# Projects whose name contains "my-project"
query=my-project

# Projects with at least one configured repo
query=reposCount>:0

# Projects using the Seer agent
query=agent:seer

# Projects configured to auto-create PRs
query=create_pr:true

# Combined: named filter + numeric threshold + agent filter
query=name:my-project reposCount>:0 agent:seer create_pr:true
```

**Response 200**

| Field                     | Type            | Description                                                                                                                  |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| id                        | string          | Project ID                                                                                                                   |
| slug                      | string          | Project slug                                                                                                                 |
| name                      | string          | Project display name                                                                                                         |
| platform                  | string \| null  | Project platform                                                                                                             |
| agent                     | string          | Which agent handles automation. One of: `seer`, `cursor`, `claude`, `none`                                                   |
| autoCreatePr              | boolean \| null | Whether the agent auto-creates a PR. `null` when `agent` is `none`.                                                          |
| autofixAutomationTuning   | string          | The tuning setting. One of: `off`, `medium` (deprecated values: `super_low`, `low`, `high`, `always`)                        |
| automatedRunStoppingPoint | string          | The stopping point. One of: `code_changes`, `open_pr` (deprecated values: `root_cause`, `solution`). Default: `code_changes` |
| reposCount                | int             | Number of repos configured for this project                                                                                  |

```json
{
  "data": [
    {
      "id": "123",
      "slug": "my-project",
      "name": "My Project",
      "platform": "python",
      "agent": "seer",
      "autoCreatePr": false,
      "automatedRunStoppingPoint": "code_changes",
      "reposCount": 2
    },
    {
      "id": "456",
      "slug": "frontend",
      "name": "Frontend",
      "platform": "javascript-react",
      "agent": "cursor",
      "autoCreatePr": true,
      "automatedRunStoppingPoint": "open_pr",
      "reposCount": 1
    },
    {
      "id": "789",
      "slug": "backend",
      "name": "Backend",
      "platform": "python-django",
      "agent": "none",
      "autoCreatePr": null,
      "automatedRunStoppingPoint": "code_changes",
      "reposCount": 0
    }
  ]
}
```

---

### Bulk Update Projects [PUT /organizations/{org}/seer/projects/]

Updates Seer automation settings for multiple projects in one request. Only the provided fields are changed; omitted fields are left as-is.

**Request**

| Field                     | Type    | Required | Description                                                          |
| ------------------------- | ------- | -------- | -------------------------------------------------------------------- |
| query                     | string  | Yes      | Search query — updates all projects matching the query               |
| agent                     | string  | No\*     | One of: `seer`, `cursor`, `claude`, `none`                           |
| autoCreatePr              | boolean | No\*     | Whether the agent auto-creates a PR. Ignored when `agent` is `none`. |
| automatedRunStoppingPoint | string  | No\*     | One of: `code_changes`, `open_pr`                                    |

\*At least one update field is required.

```json
// Update all projects matching a query
{
  "query": "agent:none reposCount>:0",
  "agent": "seer",
  "autoCreatePr": false,
  "automatedRunStoppingPoint": "code_changes"
}
```

**Response 200** — Returns the updated project objects in the same shape as the list GET.

**Response 400**

```json
{"detail": "At least one update field is required."}
```

---

### Get Project [GET /organizations/{org}/seer/projects/{project_id_or_slug}/]

Returns the full Seer settings for a single project.

**Response 200** — Same shape as a single item from the list endpoint.

---

### Update Project [PUT /organizations/{org}/seer/projects/{project_id_or_slug}/]

Updates the Seer settings for a single project. Only provided fields are changed.

**Request** — same fields as the bulk update but without `query`.

```json
{
  "agent": "cursor",
  "autoCreatePr": true,
  "automatedRunStoppingPoint": "open_pr"
}
```

**Response 200** — Returns the updated project object.

---

## Resource: Seer Project Repositories (sub-resource)

Per-project repository configurations used by Seer autofix. These are stored in the Seer service (not Sentry's DB) and represent the repos that autofix will operate on when triggered from this project.

**Replaces:**

- `preference.repositories` inside `GET/POST /projects/{org}/{project}/seer/preferences/` (DEPRECATED)
- The `projectRepoMappings` field inside `POST /organizations/{org}/autofix/automation-settings/`

---

### List Project Repos [GET /organizations/{org}/seer/projects/{project_id_or_slug}/repos/]

Returns a paginated list of repos configured for this project.

- Silo: Region

**Query Parameters**

| Parameter | Type   | Description                                 |
| --------- | ------ | ------------------------------------------- |
| sortBy    | string | One of: `name`, `provider`. Default: `name` |

**Response 200**

| Field           | Type                 | Description                                            |
| --------------- | -------------------- | ------------------------------------------------------ |
| id              | string               | Internal Seer repo config ID                           |
| provider        | string               | SCM provider key (e.g. `integrations:github`)          |
| owner           | string               | Repository owner (e.g. `getsentry`)                    |
| name            | string               | Repository name (e.g. `sentry`)                        |
| externalId      | string               | Provider-specific external ID                          |
| integrationId   | string \| null       | Integration ID for the SCM provider                    |
| branchName      | string \| null       | Override branch (default branch used if null)          |
| branchOverrides | list[BranchOverride] | Tag-based branch overrides                             |
| instructions    | string \| null       | Custom instructions for Seer when working in this repo |
| baseCommitSha   | string \| null       | Base commit SHA                                        |

```json
{
  "data": [
    {
      "id": "repo-cfg-1",
      "provider": "integrations:github",
      "owner": "getsentry",
      "name": "sentry",
      "externalId": "12345678",
      "integrationId": "456",
      "branchName": "main",
      "branchOverrides": [
        {
          "tagName": "environment",
          "tagValue": "staging",
          "branchName": "staging"
        }
      ],
      "instructions": "Follow the AGENTS.md conventions",
      "baseCommitSha": null
    }
  ]
}
```

---

### Add Repos to Project [POST /organizations/{org}/seer/projects/{project_id_or_slug}/repos/]

Appends one or more repos to this project's configuration. Duplicates (matched by `provider` + `externalId`) are ignored.

**Request**

```json
{
  "repos": [
    {
      "provider": "integrations:github",
      "owner": "getsentry",
      "name": "sentry",
      "externalId": "12345678",
      "integrationId": "456",
      "branchName": "main"
    }
  ]
}
```

**Response 201** — Returns the newly added repo configuration objects.

---

### Replace All Project Repos [PUT /organizations/{org}/seer/projects/{project_id_or_slug}/repos/]

Replaces the entire repo list for this project. Send an empty array to remove all repos.

**Request**

```json
{
  "repos": [
    {
      "provider": "integrations:github",
      "owner": "getsentry",
      "name": "sentry",
      "externalId": "12345678"
    }
  ]
}
```

**Response 200** — Returns the full updated repo list.

---

### Get Project Repo [GET /organizations/{org}/seer/projects/{project_id_or_slug}/repos/{repo_id}/]

Returns a single repo configuration for this project.

**Response 200** — Same shape as a single item from the list endpoint.

---

### Update Project Repo [PUT /organizations/{org}/seer/projects/{project_id_or_slug}/repos/{repo_id}/]

Updates a single repo configuration. Only provided fields are changed.

```json
{
  "branchName": "develop",
  "instructions": "Use TypeScript strict mode"
}
```

**Response 200** — Returns the updated repo configuration.

---

### Remove Project Repo [DELETE /organizations/{org}/seer/projects/{project_id_or_slug}/repos/{repo_id}/]

Removes a single repo from this project's configuration.

**Response 204** — No content.

---

## Resource: Seer Repositories

Seer-scoped view of organization repositories with their code review settings. This is a frontend-optimized replacement for `/organizations/{org}/repos/?expand=settings` + the sibling `/organizations/{org}/repos/settings/` bulk endpoint.

**Replaces:**

- `GET /organizations/{org}/repos/` with `expand=settings` (settings buried in expand, no sorting)
- `PUT /organizations/{org}/repos/settings/` (bulk-only, no individual update)

---

### List Org Repos [GET /organizations/{org}/seer/repos/]

Returns a paginated list of the organization's repositories with their Seer code review settings.

- Silo: Region

**Query Parameters**

| Parameter         | Type    | Description                                                |
| ----------------- | ------- | ---------------------------------------------------------- |
| query             | string  | Filter by repository name (case-insensitive contains)      |
| sortBy            | string  | One of: `name`, `dateCreated`, `provider`. Default: `name` |
| enabledCodeReview | boolean | `true` to show only repos with code review enabled         |
| integrationId     | string  | Filter by integration ID                                   |
| status            | string  | One of: `active` (default), `deleted`, `unmigratable`      |

**Response 200**

| Field              | Type           | Description                                                   |
| ------------------ | -------------- | ------------------------------------------------------------- |
| id                 | string         | Repository ID                                                 |
| name               | string         | Repository name (e.g. `getsentry/sentry`)                     |
| url                | string \| null | Repository URL                                                |
| provider           | object         | `{ "id": string, "name": string }`                            |
| status             | string         | Repository status                                             |
| dateCreated        | datetime       | When the repository was added                                 |
| integrationId      | string \| null | Associated integration ID                                     |
| externalSlug       | string \| null | Provider-specific slug                                        |
| externalId         | string \| null | Provider-specific external ID                                 |
| enabledCodeReview  | boolean        | Whether Seer code review is enabled for this repository       |
| codeReviewTriggers | string[]       | When code review runs: `on_new_commit`, `on_ready_for_review` |

```json
{
  "data": [
    {
      "id": "123",
      "name": "getsentry/sentry",
      "url": "https://github.com/getsentry/sentry",
      "provider": {"id": "integrations:github", "name": "GitHub"},
      "status": "active",
      "dateCreated": "2024-01-15T00:00:00Z",
      "integrationId": "456",
      "externalSlug": "getsentry/sentry",
      "externalId": "12345678",
      "enabledCodeReview": true,
      "codeReviewTriggers": ["on_new_commit", "on_ready_for_review"]
    }
  ]
}
```

---

### Bulk Update Org Repos [PUT /organizations/{org}/seer/repos/]

Updates code review settings for multiple repositories. Only provided fields are changed.

**Request**

| Field              | Type     | Required | Description                                                   |
| ------------------ | -------- | -------- | ------------------------------------------------------------- |
| query              | string   | Yes      | Search query — updates all repos matching the query           |
| enabledCodeReview  | boolean  | No\*     | Whether code review is enabled                                |
| codeReviewTriggers | string[] | No\*     | When code review runs: `on_new_commit`, `on_ready_for_review` |

\*At least one update field is required.

```json
// Enable code review on all repos that don't have it yet
{
  "query": "enabledCodeReview:false",
  "enabledCodeReview": true,
  "codeReviewTriggers": ["on_new_commit", "on_ready_for_review"]
}
```

**Response 200** — Returns the updated repo objects in the same shape as the list GET.

---

### Get Org Repo [GET /organizations/{org}/seer/repos/{repo_id}/]

Returns a single repository with its Seer code review settings.

**Response 200** — Same shape as a single item from the list endpoint.

---

### Update Org Repo [PUT /organizations/{org}/seer/repos/{repo_id}/]

Updates the Seer code review settings for a single repository. Only provided fields are changed.

```json
{
  "enabledCodeReview": true,
  "codeReviewTriggers": ["on_new_commit", "on_ready_for_review"]
}
```

**Response 200** — Returns the updated repository object.

---

## Shared Types

### Agent field

The `agent` field on a project encapsulates both the legacy `autofixAutomationTuning` and `automationHandoff.target` into a single, frontend-friendly value.

| `agent` value | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `none`        | Automation is off. `autoCreatePr` is `null`.                     |
| `seer`        | Seer handles the full automation run, including any PR creation. |
| `cursor`      | Seer hands the run off to Cursor after root-cause analysis.      |
| `claude`      | Seer hands the run off to Claude after root-cause analysis.      |

The `autoCreatePr` field is only meaningful when `agent` is not `none`. When writing, setting `agent: none` implicitly clears `autoCreatePr`; the stored value is not returned.

### BranchOverride

| Field      | Type   | Description                            |
| ---------- | ------ | -------------------------------------- |
| tagName    | string | The event tag key to match             |
| tagValue   | string | The event tag value to match           |
| branchName | string | The branch to use when the tag matches |

---

## Endpoint Summary

| Method | Path                                                         | Description                                   |
| ------ | ------------------------------------------------------------ | --------------------------------------------- |
| GET    | `/organizations/{org}/seer/projects/`                        | Paginated list of projects with Seer settings |
| PUT    | `/organizations/{org}/seer/projects/`                        | Bulk update multiple projects                 |
| GET    | `/organizations/{org}/seer/projects/{project}/`              | Get single project's Seer settings            |
| PUT    | `/organizations/{org}/seer/projects/{project}/`              | Update single project's Seer settings         |
| GET    | `/organizations/{org}/seer/projects/{project}/repos/`        | Paginated list of repos for a project         |
| POST   | `/organizations/{org}/seer/projects/{project}/repos/`        | Append repos to a project                     |
| PUT    | `/organizations/{org}/seer/projects/{project}/repos/`        | Replace all repos for a project               |
| GET    | `/organizations/{org}/seer/projects/{project}/repos/{repo}/` | Get single repo config for a project          |
| PUT    | `/organizations/{org}/seer/projects/{project}/repos/{repo}/` | Update single repo config for a project       |
| DELETE | `/organizations/{org}/seer/projects/{project}/repos/{repo}/` | Remove a repo from a project                  |
| GET    | `/organizations/{org}/seer/repos/`                           | Paginated list of org repos with settings     |
| PUT    | `/organizations/{org}/seer/repos/`                           | Bulk update multiple org repos                |
| GET    | `/organizations/{org}/seer/repos/{repo}/`                    | Get single org repo with settings             |
| PUT    | `/organizations/{org}/seer/repos/{repo}/`                    | Update single org repo settings               |

---

## Migration Notes

| Old Endpoint                                                         | Replaced By                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /organizations/{org}/autofix/automation-settings/`              | `GET /organizations/{org}/seer/projects/`                          |
| `POST /organizations/{org}/autofix/automation-settings/`             | `PUT /organizations/{org}/seer/projects/`                          |
| `GET/PUT /projects/{org}/{project}/` (Seer fields)                   | `GET/PUT /organizations/{org}/seer/projects/{project}/`            |
| `GET/POST /projects/{org}/{project}/seer/preferences/` (repos field) | `GET/POST/PUT /organizations/{org}/seer/projects/{project}/repos/` |
| `GET /organizations/{org}/repos/?expand=settings`                    | `GET /organizations/{org}/seer/repos/`                             |
| `PUT /organizations/{org}/repos/settings/`                           | `PUT /organizations/{org}/seer/repos/`                             |

**Not replaced by this document (unchanged):**

- `GET /organizations/{org}/seer/onboarding-check/`
- `GET/POST /organizations/{org}/integrations/coding-agents/`
- `GET /organizations/{org}/projects/` (general use, kept as-is)
- `GET /organizations/{org}/repos/` (general use, kept as-is)
