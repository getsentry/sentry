---
name: cell-architecture
description: >-
  Reference and active migration guide for Sentry's cell architecture. Explains what cells and
  localities are and why they're different, how requests reach cells via Synapse API routing,
  ingestion routing, and the control silo gateway, and how to safely query cross-cell data without
  silently missing results. The migration section covers how to do migration work: draining the
  URL_NAME_TO_ACTION registry in test_urls.py to zero (with a recipe for each action type),
  rolling deploy safety and the two-phase pattern required by independent sentry/getsentry deploys,
  and the region -> cell rename including what not to rename (DB columns, AWS refs, uptime regions,
  billing address). Also documents known issues with proposed fixes: org listing and creation
  without a slug, integration TeamLinkageView routing, Jira cross-cell fan-out, and relocation
  endpoint routing.
---

> **Status**: Active migration in progress. Migration-specific sections should be removed once complete, leaving a stable architecture reference.

# Cells

## Cell vs Locality

These are two different layers of the architecture.

**Cell** — a self-contained Sentry deployment that owns a subset of organizations. Each cell
runs its own full stack — Getsentry, Snuba, Seer, Relay, Kafka, Symbolicator, and others —
on an isolated network with no direct cell-to-cell communication. `OrganizationMapping.cell_name`
records which cell an org lives in. See [Paths Into a Cell](#paths-into-a-cell) for how cells
communicate with the outside world.

**Locality** — a named collection of cells, representing either a data residency zone (for
multi-tenant customers, e.g. "us", "de") or a dedicated deployment for a single customer
(e.g. `s4s2`). Multi-tenant customers choose a locality when creating an organization;
single-tenant localities are provisioned privately and not customer-selectable. Each locality
maps to a subdomain (`us.sentry.io`, `de.sentry.io` or `s4s2.sentry.io`).

> **Note**: "region" is the old name for "cell". The codebase is actively being migrated.
> See [Active Migration](#active-migration) for details.


## Paths Into a Cell

There are three high-level paths by which requests or data reach a cell.

### 1. Locality API — `{locality}.sentry.io`

Synapse ([getsentry/synapse](https://github.com/getsentry/synapse)) routes each request to
the correct getsentry cell within a locality, using an **org to cell mapping** it caches from control's
`OrganizationMapping`.

```
us.sentry.io   ->  Synapse (API proxy)  ->  US cell(s)
de.sentry.io   ->  Synapse (API proxy)  ->  DE cell(s)
s4s2.sentry.io ->  S4S2 cell (single cell, no Synapse)
```

For Synapse to route a request, the URL must contain `organization_id_or_slug`. The canonical
shape is `/api/0/organizations/<organization_id_or_slug>/...` — `getsentry/tests/getsentry/test_urls.py`
enforces this and fails CI for any `@cell_silo_endpoint` that doesn't conform.

When generating URLs for org-scoped resources, use `org.locality.to_url(path)` — derives the
correct locality URL across SaaS, self-hosted, single-tenant, and dev deployments:

```python
url = org.locality.to_url(f"/organizations/{org.slug}/issues/{issue.id}/")
```

For single-cell localities Synapse is an optional pass-through.

### 2. Ingestion — `ingest.{locality}.sentry.io`

A separate Synapse deployment routes each ingestion request to the correct cell using a **public key to cell mapping** it caches from control. The project config returned by Synapse includes the cell's Relay URL directly, which high-volume Relay deployments use to bypass Synapse for subsequent high-volume submission.

```
Standard:    ingest.us.sentry.io  ->  Synapse (ingest-router)  ->  cell's Relay
High-volume: ingest.us.sentry.io  ────────────────────────────->  cell's Relay
```

DSN hosts vary — legacy formats carry no locality or org info — so the ingest-router always routes by public key, which is present in every request regardless of DSN format.

The `o{org_id}.ingest.{locality}` subdomain also serves a second routing purpose: the user feedback embed widget (`sentry-error-page-embed`) posts to `sentry.io` with the project's DSN as a query param. Since the URL has no org slug, the API gateway can't route it the normal way — instead it parses the locality out of the DSN host. If the DSN was issued in a legacy format without a locality, the gateway can't determine the cell and the embed widget breaks silently for that org.

For single-cell localities the ingest-router is an optional pass-through.

### 3. Control silo — `sentry.io`

`sentry.io` is the getsentry control silo deployment. Control communicates with cells through three mechanisms:

**API Gateway** (`ApiGatewayMiddleware` -> `apigateway.py`) — synchronously proxies
org-scoped API requests that arrive at `sentry.io` but belong on a cell:
- Org slug/id in path, resolve cell via `get_cell_for_organization()`
- Error embed (`sentry-error-page-embed`) -> parse locality from DSN subdomain
- `REGION_PINNED_URL_NAMES` proxy to the monolith cell (the original US cell). Legacy endpoints like `/api/0/issues/{id}/` have no org slug so the gateway can't resolve the cell dynamically; they always route to US and will 404 for issues in other cells

**Integration webhook forwarding** (`IntegrationControlMiddleware` -> `BaseRequestParser`) —
inbound webhooks arrive at control, which identifies target cells via `OrganizationIntegration`. `organization_mapping_service`, then delivers using one of three strategies:

- **`WebhookPayload` async queue** (default; GitHub, most providers) — creates one record per
  target cell, returns 202 immediately; background worker delivers with retries
- **Immediate ACK + async Celery task** (Slack, Discord) — returns ACK immediately, fires a
  task that calls the cell and forwards the real response via the provider's callback URL
- **Control silo only** (setup flows, link/unlink, event challenges) — no cell forwarding

**RPC** — synchronous cross-silo calls. Each service is local to one silo; the other calls
it remotely. For creating or modifying RPC services -> **hybrid-cloud-rpc** skill.


## Cross-Cell Data Access

> **Dev / Monolith mode**: In local development, all data lives in a single DB and cross-cell
> bugs are **invisible locally** — they only surface in a siloed staging or production environment.

A user can belong to organizations in different cells. Any query that filters org-scoped data
through a cross-cell relationship — membership, team assignment, or similar — silently returns
**incomplete results** when run inside a single cell: it only sees the orgs that live in that cell.

```python
# Looks correct, silently wrong in multi-cell — misses orgs in other cells:
Organization.objects.get_for_user_ids({user_id})
Project.objects.filter(teams__organizationmember__user_id=user_id)
```

### Available Infrastructure

- **`OrganizationMemberMapping`** (control) — `(user_id, organization_id, role, invite_status)`
  for every member across all cells. The canonical user->org index; start here.
- **`OrganizationMapping`** (control) — maps `organization_id` -> `cell_name`
- **`organization_service.get_organization_by_id()`** — fetches org details; routes to the
  correct cell automatically
- **`find_cells_for_user(user_id)`** — returns cell names containing the user's orgs (use when
  you need to fan out to cells but don't need membership data; calls `OrganizationMemberMapping`
  internally)

### Resolution Patterns

| Pattern | When to use |
|---|---|
| **Control index + RPC fan-out** | Real-time accuracy required; moderate org count per user. Use `OrganizationMemberMapping` to get org IDs, then `organization_service` RPC per org (or batch by cell via `OrganizationMapping`). |
| **Denormalize to control silo** | High QPS, paginated lists, eventual consistency acceptable. Replicate needed fields to a `@control_silo_model` via outboxes — single local query, no RPC. See **hybrid-cloud-outboxes** skill. |
| **API gateway fan-out** | Temporary stopgap only — breaks pagination, latency = slowest cell. |


## Active Migration

> Remove this section once the migration is complete.

Use `TODO(cells)` to track deferred migration work so it's searchable:

```python
# TODO(cells): rename metric to "cell.foo" once getsentry dashboards are updated
metrics.incr("region.foo", tags=metric_tags)
```

### Migration Guide

#### Cell Endpoint URL Shape

Public `@cell_silo_endpoint` URLs must include `organization_id_or_slug` so Synapse can route them — see [Paths Into a Cell](#paths-into-a-cell). `getsentry/tests/getsentry/test_urls.py` enforces this in CI and fails if a non-conforming URL has no registered plan.

**The goal is to drain `URL_NAME_TO_ACTION` to zero.** Each entry is a non-conforming endpoint with a label describing what needs to happen to it. When you fix one, remove it from the map. No new non-conforming entries should be added.

Endpoints decorated with `@internal_cell_silo_endpoint` are exempt from the check.

**Actions and what fixing them looks like:**

- `TO_BE_REPLACED_WITH_ORG_SCOPED_VARIANT` — add `organization_id_or_slug` to the URL path so Synapse can route it
- `TO_BE_REPLACED_WITH_CELL_SCOPED_VARIANT` — `_admin` staff-only endpoint; scope it to a cell by adding a cell ID parameter (pattern: `^api/0/_admin/cells/(?P<cell_id>[^/]+)/`)
- `TO_BE_CONTROL_ONLY` — move the endpoint to `@control_silo_endpoint`
- `TO_BE_INTERNAL_ONLY` — change to `@internal_cell_silo_endpoint`; this exempts it from the routing requirement
- `TO_BE_STANDARDIZED` — fix a URL typo or convention mismatch (e.g. missing org slug support, path not following existing conventions)
- `TO_BE_SELF_HOSTED_ONLY` — move behind a self-hosted guard so it's not reachable in SaaS cells
- `TO_BE_DEPRECATED` — endpoint is being removed. Before touching anything: search the getsentry GitHub org for the URL name and path to find all callers. Then add a `X-Sentry-Deprecation-Date` response header while still live (see `_add_deprecation_headers` in `sentry/api/helpers/deprecation.py`). When fully removed: delete from `src/sentry/api/urls.py`, the view file, `URL_NAME_TO_ACTION`, and `src/sentry/apidocs/` if public.
- `TO_BE_DELETED` - not a public endpoint, can be removed immediately without deprecation
- `TO_BE_BROKEN` — known broken, no owner; deferred indefinitely (only relocation, do not add entries)
- `TO_BE_INVESTIGATED_ECOSYSTEM_TEAM` — deferred until the ecosystem team determines the right fix


#### Rolling Deploy Safety

**Never assume atomic deployment.** There are two independent deployment boundaries to consider:

1. **Sentry rolling deploy** — old and new sentry pods run simultaneously during rollover. Any
   change to a wire format, RPC method signature, DB schema, or serialized field must be safe
   for old pods to receive from new pods, and vice versa.

2. **Sentry <-> getsentry** — sentry and getsentry are always deployed independently and at
   different times. Anything sentry exports that getsentry imports (classes, functions,
   constants, decorators) must remain importable under its old name until getsentry has
   deployed the update. Keep the old name as an alias; never do a hard rename in a single deploy.

The required pattern for any breaking change is **two phases**:

**Phase 1** — deploy backward-compatible code: add the new name/field/format alongside the old.
Both old and new versions of each service can handle both.

**Phase 2** — deploy cleanup: remove the old name/field/format once both sentry and getsentry
are on the new code.

This applies to:
- Python symbols exported from sentry and imported by getsentry (keep old name as alias)
- RPC request/response fields (adding, removing, or renaming)
- DB columns: new columns must be nullable or have defaults; don't drop a column in the same deploy that stops writing it; when **renaming a Python field**, set `db_column="old_name"` to avoid a schema migration entirely — the DB column stays unchanged and is safe across rolling deploys
- API response shape changes
- Any data written to outboxes, queues, or caches that may be read by older code


#### region -> cell Rename

The codebase is actively migrating from "region" to "cell" terminology.

**New code must not use "region" to mean "cell" or "locality"** — this applies to all Python
symbols, variable names, function names, class names, comments, log keys, and docstrings.

**Before renaming, identify which concept the code is referring to:**

- If it refers to a single deployment unit that owns a subset of organizations -> **cell**
  (`cell_name`, `get_cell_for_organization`, `CellSiloClient`, etc.)
- If it refers to a named collection of cells / data residency zone (`"us"`, `"de"`) -> **locality**
  (`locality`, `org.locality`, `Locality`, etc.)

Most existing `region` usage maps 1:1 to `cell`, but some (especially where the code handles
`"us"` / `"de"` subdomain routing or customer-facing zone selection) maps to `locality`. Check
the context before renaming.

**Do NOT rename:**
- `db_column="region_name"` — DB schema stays for backward compatibility; only the Python attribute name changes
- AWS/cloud references (`aws-lambda.host-region`, etc.), such as in AWS integrations
- Uptime regions — probe/check locations, a separate concept from cells and localities
- Customer's billing `region` in getsentry — postal address state/province for tax, etc, unrelated to cell infrastructure

**Rename with caution** — sentry and getsentry deploy independently on different schedules, so both old and new names must work simultaneously during the transition:
- **Metrics** (`metrics.incr("region.*")`) — dashboards and alerts reference metric names; emit both old and new names until getsentry dashboards are updated, then drop the old.
- **Runtime options** (`options.get("hybridcloud.regionsiloclient.*")`) — values are set in production via `sentry-options-automator` in getsentry; register the new key alongside the old, migrate getsentry config, then remove the old key in a later deploy
- **Settings** — these are configured in getsentry and ops codebase and through settings files and environment variables; use extreme caution to avoid breaking production with a bad rename. Follow the two-phase pattern.


### Known Issues

Specific broken areas with a description of the problem and the proposed fix. Remove each entry once resolved.

#### Org Operations Without an Existing Org Slug

Several org lifecycle operations have no existing org slug to route by, so Synapse can't route them to a specific cell within a locality:

- **Org listing** — the frontend fans out `/organizations/` to each locality URL (`useOrganizationsWithRegion`). `OrganizationIndexEndpoint` is `@cell_silo_endpoint` and queries `Organization.objects.get_for_user_ids()`, so even if it reaches a cell it only returns orgs in that cell.
- **Org creation** — the user picks a locality but there's no mechanism to select which cell within that locality the new org lands in.

**The fix for listing**: move `OrganizationIndexEndpoint` to `@control_silo_endpoint` and query `OrganizationMemberMapping` (user -> org IDs) joined with `OrganizationMapping` — both already exist on control silo. Some response fields (e.g. avatar, auth provider, features) are not yet in `OrganizationMapping` and would need to be replicated or dropped.

**Org creation**: `Locality.new_org_cell` to route new orgs to the correct cell within the selected locality.


#### Integration Views and Cell Routing

`TeamLinkageView` (link-team, unlink-team) is broken in two ways: it uses signed URLs with `integration_id` instead of org slug so Synapse can't route it, and it queries `OrganizationMember.get_for_integration()` (cell-silo) so it only sees orgs in the current locality anyway.

**The fix**:
1. `@control_silo_view` — makes the URL reachable without Synapse
2. Replace `OrganizationMember.get_for_integration()` with `OrganizationMemberMapping` + `integration_service.get_organization_integrations()` for cross-cell membership
3. Fetch `Team` and write `ExternalActor` via RPC into the correct cell — requires new RPC methods (see **hybrid-cloud-rpc** skill)

`IdentityLinkageView` is already `@control_silo_view` and doesn't need migration.


#### Jira Issue Details Cross-Cell Fan-out

The Jira sidebar panel ("Sentry -> Linked Issues") is blocked from multi-cell installation via `is_cell_restricted = True` instead of being fixed properly. The descriptor points to `JiraSentryIssueDetailsView` (`@cell_silo_view`), which queries a single cell's DB. `JiraSentryIssueDetailsControlView` (`@control_silo_view`) already exists at `/extensions/jira/issue-details/{issue.key}/` with correct `find_cells_for_orgs` fan-out — the fix is to point the descriptor at that URL and remove `is_cell_restricted`.


#### Relocation Endpoint Routing

All relocation endpoints are `@cell_silo_endpoint` with no org slug — `/relocations/`, `/publickeys/relocations/`, and the UUID-based management endpoints (`/relocations/{uuid}/abort/` etc.) — so Synapse can't route any of them in a multi-cell locality. Likely fix: UUID-based endpoints via a control-silo `uuid -> cell` lookup; list and public key endpoints follow the org-creation pattern (locality selection -> control picks a cell). Will be addressed as part of the Monarch project (org migration between cells).
