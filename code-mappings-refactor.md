# Code Mappings Refactor

**Linear:** [Code mappings refactor](https://linear.app/getsentry/project/code-mappings-refactor-d3987c38f5f1/overview)
**Design:** [SCM — code mapping (Figma)](https://www.figma.com/design/Bb7oTvPuL7OXL748s6kKp3/SCM---code-mapping?node-id=3520-44248)

---

## Overview

### Problem

A code mapping tells Sentry how to translate a stack trace file path into a file path inside a source repository. Today each mapping — a `(project, repo, stackRoot, sourceRoot, branch)` tuple — is created one at a time through the integration's **Code Mappings** tab. The UI models each row as the primary object, which inverts the real relationship: the meaningful association is _project ↔ repo_, and the path rules are just configuration under it.

This makes the feature hard to discover (you have to navigate through the integration, not the project), impossible to manage multiple path rules in one save, and leaves disconnect semantics undefined at the product level.

### Goal

Treat the **project ↔ repo connection** as the first-class object. Path mappings are an ordered list _under_ that connection. The same modal surfaces from two entry points — project General Settings and the org Repositories page — with one field locked depending on where you start.

Concretely:

- **Project settings → Connected Repositories panel** — see every repo linked to this project, click `+ Connect repository` to open the modal with the project locked.
- **Org Repositories → repo row** — click `+` (or the edit action) to open the modal with the repo locked.
- **Modal** — pick the other side, configure N paths (stackRoot → sourceRoot, per-path branch), live preview, overlap/catch-all warnings, save all at once.
- **Edit** — same modal, both sides locked, paths prefilled; diff on save (POST new, PUT changed, DELETE removed).
- **Disconnect** — confirm dialog showing which other projects are still connected to that repo and which mappings will be removed.

### What stays the same

The existing integration **Code Mappings** tab is not removed in this project. It remains for teams not yet on the new flag. A later cutover milestone will remove it once the new surfaces are stable.

### Backend model

No new database migrations are required for the core work. `ProjectRepository` already exists as the canonical project ↔ repo join table and `RepositoryProjectPathConfig` is already a child of it. The main gap is UI-layer: today the product never writes `ProjectRepository` directly through a user action (it's created implicitly when a mapping is saved). We will start doing so explicitly via the existing `POST /projects/{org}/{project}/repo/` endpoint.

---

## Prior work from Evan Purkhiser

Before starting, recover Evan's component groundwork. Do **not** rewrite from scratch.

### Already on master

- **[#114591](https://github.com/getsentry/sentry/pull/114591)** `feat(repos): Add SCM repositories v2 page behind feature flag` — now the live Repositories page at `static/app/views/settings/organizationRepositories/`. The `scm-repositories-v2` feature flag was removed in [#116555](https://github.com/getsentry/sentry/pull/116555); the page is unconditional. `ScmRepositoryTable` has a `repoActions` prop per repo row — currently unused — that is exactly where the "connect / edit" modal trigger belongs.

### Merged then deleted as unused

- **[#117191](https://github.com/getsentry/sentry/pull/117191)** `PathMapping` row component — scraps form (Zod), collapsed `stackRoot → sourceRoot` summary with overflow tooltips and accent path highlight, expand-to-edit form with branch input, live preview panel. Merged Jun 9.
- **[#117375](https://github.com/getsentry/sentry/pull/117375)** `PathMapping` refinements — trailing-slash normalisation on blur, field copy updated to "Stack trace prefix" / "Source code replacement". Merged Jun 10.
- **[#122986](https://github.com/getsentry/sentry/pull/122986)** `ref(✂️): remove unused path mapping` — deleted the entire `static/app/components/connectRepository/` directory on Aug 31 because nothing wired it up. The final merged source lives at commit `53ec1cd084c`.

Restoration is a simple `git show 53ec1cd084c:static/app/components/connectRepository/pathMapping.tsx` — no regressions to fix, just copy it back and align the field copy with the current Figma design.

### Closed, never merged

- **[#117306](https://github.com/getsentry/sentry/pull/117306)** `PathMappingList` — the list orchestration layer on top of `PathMapping`. Seeds from persisted mappings (or one empty row), keeps one row expanded at a time, "Add another path" reopens the trailing empty row instead of stacking blanks, omits empty rows from `onChange`, blocks add while a duplicate is unresolved. Retrieve the source from the PR branch. Two bugs flagged by Bugbot that must be fixed before landing:
  1. `handleChange` and `handleDelete` close over stale `entries` instead of using functional state updates.
  2. Deleting the last mapping leaves an empty list (initial state always seeds one empty row — the delete path should mirror that).

---

## Data models

### `Repository` — `sentry_repository`

Org-scoped. Keyed by `(organization_id, provider, external_id)`. Holds the repo `name`, `url`, and `integration_id`. Not project-scoped.

### `ProjectRepository` — `sentry_projectrepository`

The canonical project ↔ repo association.

```
unique_together = (project, repository)
source: MANUAL=0 | SCM_ONBOARDING=1 | AUTO_EVENT=2 | AUTO_NAME_MATCH=3 | SEER_PREFERENCE=4
```

`get_or_create_with_source` upgrades `source` when a higher-priority signal arrives (manual and scm_onboarding both carry priority 500, higher than auto_event at 200). No public DELETE endpoint exists today.

### `RepositoryProjectPathConfig` — `sentry_repositoryprojectpathconfig`

The path mapping row. Lives under a `ProjectRepository`.

```
project_repository  FK → ProjectRepository (CASCADE)
organization_integration_id  HybridCloudFK → OrganizationIntegration (CASCADE)
organization_id, integration_id  denormalized for query filtering
stack_root, source_root  TextField
default_branch  TextField (nullable)
automatically_generated  BooleanField

UNIQUE (project_repository, stack_root, source_root)
```

The serializer response shape (used throughout the frontend):

```
id, projectId, projectSlug, repoId, repoName,
integrationId, provider, stackRoot, sourceRoot,
defaultBranch, automaticallyGenerated
```

Post-save fires `update_code_owners_schema` to re-apply CODEOWNERS rules for the project. The bulk endpoint sets `_skip_post_save = True` during the batch and fires it once at the end.

### `ProjectCodeOwners` — `sentry_projectcodeowners`

`repository_project_path_config` FK with `unique=True` and `on_delete=PROTECT`. **A mapping cannot be deleted while a CODEOWNERS row references it.** The API returns 409.

### Control-silo models

`Integration` (keyed by `(provider, external_id)`) → `OrganizationIntegration` (keyed by `(organization_id, integration_id)`). The mapping's `organization_integration_id` is a `HybridCloudForeignKey` pointing here.

### Relationship diagram

```
Organization
  └── Integration (control silo)
        └── OrganizationIntegration (control silo)
              └── RepositoryProjectPathConfig
  └── Repository  ──────────────────────────────┐
  └── Project                                   │
        └── ProjectRepository ─ unique(project, repository)
              └── RepositoryProjectPathConfig (1:N)
                    └── ProjectCodeOwners (0:1, PROTECT)
```

### Consumers of mappings

At request time, `get_sorted_code_mapping_configs(project)` loads all configs for a project and sorts them: manual before auto-generated → absolute `stack_root` before relative → longer `stack_root` first → deterministic `id`. First match wins.

- **Stacktrace link** (`GET .../stacktrace-link/`) — rewrites the frame path and builds an SCM URL to open the line in source.
- **Suspect commits** — same rewrite feeds `get_blame_for_files`.
- **Source context** (`GET .../stacktrace-source-context/`) — fetches file contents from SCM at the matched path.
- **CODEOWNERS** — `convert_codeowners_syntax` translates CODEOWNERS file paths through the `stack_root ↔ source_root` rewrite for issue ownership rules.
- **Seer** — `auto_source_code_config` creates `automatically_generated=True` mappings from event data; Seer also reads them to discover relevant repo files.

---

## API endpoints

All paths are under `/api/0/`. `{org}` is `organization_id_or_slug`.

### Code mapping CRUD

**`GET /organizations/{org}/code-mappings/`**
List mappings for the org. Optional `?integrationId=` and `?project=` (multi-value) filters. Paginated. Returns the serializer response shape above.

**`POST /organizations/{org}/code-mappings/`**
Create one mapping. Body: `integrationId`, `repositoryId`, `projectId`, `stackRoot`, `sourceRoot`, `defaultBranch`. Permission: `OrganizationIntegrationsLoosePermission` (`org:read` minimum; checked in view). Creates or upgrades the backing `ProjectRepository` row with `source=MANUAL`.

**`PUT /organizations/{org}/code-mappings/{configId}/`**
Update a mapping. Same fields as POST. Moving to a different project is access-checked.

**`DELETE /organizations/{org}/code-mappings/{configId}/`**
Delete a mapping. Returns 409 if a `ProjectCodeOwners` row references it.

**`POST /organizations/{org}/code-mappings/bulk/`**
Batch create/upsert up to 300 mappings for a single `(project, repository)` pair. Requires `org:ci` scope — **not usable from the product UI without a permission change**. Defers post-save side effects until the batch completes.

**`GET /organizations/{org}/derive-code-mappings/`**
Suggest `(stackRoot, sourceRoot)` pairs by matching `?stacktraceFilename` against the repo's file tree (GitHub/GitLab API). Used by the issue-details stacktrace link modal for suggestions.

**`POST /organizations/{org}/derive-code-mappings/`**
Create a mapping from a derive suggestion. Available but not currently called by the frontend.

**`GET /organizations/{org}/code-mappings/{configId}/codeowners/`**
Fetch the raw CODEOWNERS file from SCM via the mapping's repo and `defaultBranch`.

### Project-scoped endpoints

**`POST /projects/{org}/{project}/repo/`**
Link a repository to a project. Creates or upgrades a `ProjectRepository` row (`source=SCM_ONBOARDING`). Returns 201 on create, 200 if the link already exists. **No GET or DELETE endpoint exists today.**

**`POST /projects/{org}/{project}/repo-path-parsing/`**
Parse a pasted SCM file URL into `(integrationId, repositoryId, stackRoot, sourceRoot, defaultBranch)`. Used by the issue-details stacktrace link modal.

**`GET /projects/{org}/{project}/stacktrace-link/`**
Resolve a stack frame path to an SCM URL using the project's sorted mappings.

**`GET /projects/{org}/{project}/stacktrace-source-context/`**
Fetch source file lines from SCM via the first matching mapping.

### Integration repos

**`GET /organizations/{org}/integrations/{integrationId}/repos/`**
List repos available under an integration installation. Used to populate the repository dropdown in the connect modal. Returns `defaultBranch` per repo.

### Backend gaps to be aware of

- No `DELETE /projects/{org}/{project}/repo/` — disconnecting all mappings does not automatically remove the `ProjectRepository` row. A follow-up issue in M8 should address whether we need to add this.
- The bulk endpoint (`org:ci`) cannot be used from the product UI. The connect modal will issue individual `POST /code-mappings/` calls per path.

---

## Milestones

New surfaces are gated behind the `organizations:code-mappings-refactor` feature flag. The existing integration Code Mappings tab is untouched throughout.

---

### M0 — Feature flag

**Issue M0-1: Register `organizations:code-mappings-refactor` feature flag**

Register the flag so the new surfaces can be gated incrementally. Nothing renders differently yet; the flag is just available.

**Files:**

- `src/sentry/features/__init__.py` — add `organizations:code-mappings-refactor` with `OrganizationFeature`
- `src/sentry/features/permanent.py` or `temporary.py` — register with `default=False`
- `src/sentry/conf/server.py` — add to `SENTRY_FEATURES`
- `static/app/utils/withIssueTags.tsx` or the org features list — add the TS type if there is a strict enum

**Tests:**

- Verify the flag resolves to `False` by default in an org feature context.

**Out of scope:** Any UI change.

---

### M1 — Project settings: Connected Repositories panel shell

**Issue M1-1: Add Connected Repositories panel to Project General Settings**

Add a "Connected Repositories" panel section to `projectGeneralSettings/index.tsx`, gated by `organizations:code-mappings-refactor`. Initially shows an empty state ("No repositories connected") and a `+ Connect repository` button that is present but does not open a modal yet (no-op or `disabled`). The panel is not rendered when the flag is off.

**Files:**

- `static/app/views/settings/projectGeneralSettings/index.tsx` — insert `ConnectedRepositoriesPanel` below the Project Details section, wrapped in a feature flag check.
- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.tsx` (new) — panel component with header, empty state, and the button stub.
- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.spec.tsx` (new) — tests.

**Tests:**

- Panel does not render when `organizations:code-mappings-refactor` is off.
- Panel renders with the empty-state copy and the `+ Connect repository` button when the flag is on.
- The button is present (even if not yet functional).

**Out of scope:** Loading real data, opening any modal.

**Depends on:** M0-1.

---

### M2 — Project settings: panel rows

**Issue M2-1: Load and display connected repository rows in the panel**

Load `GET /organizations/{org}/code-mappings/?project={projectSlug}` and group results by `repoId`. For each connected repo render a row: provider icon, `org/repo` name, mapping count badge (`2 mappings`), and an overflow (`...`) menu with **Edit** and **Disconnect** items that are disabled (with a tooltip "Coming soon") until M7 and M8 land. Show a skeleton placeholder while the request is in flight. The "All resolve" health tag is **M10**, not this issue.

**Files:**

- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.tsx` — replace the static empty state with a data-driven list; add the `useInfiniteQuery` call via `apiOptions`.
- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.spec.tsx` — extend tests.

**Endpoint used:** `GET /organizations/{org}/code-mappings/` with `?project=` filter.

**Response fields consumed:** `repoId`, `repoName`, `provider`, `integrationId`; count rows per `repoId` for the badge.

**Tests:**

- Loading skeleton renders while the query is in flight.
- One repo row renders with provider icon, name, and `1 mapping`.
- Multiple mappings to the same repo collapse into one row with `N mappings`.
- Overflow menu is present; Edit and Disconnect items are disabled.
- "All resolve" badge is absent (lands in M10).

**Out of scope:** Edit, Disconnect, "All resolve" health badge (M10).

**Depends on:** M1-1.

---

### M3 — Connect modal: shell

**Issue M3-1: Add the "Connect a repository" modal shell**

Create the modal opened by `+ Connect repository` in the panel. The modal title is "Connect a repository to {projectName}". The project field is a locked read-only display (not a selector). The repository field is a searchable dropdown populated from `GET /organizations/{org}/integrations/{integrationId}/repos/` for each integration the org has. When no repository is selected, the paths area shows "Select a repository first to configure code paths". The Save button is disabled. Cancel closes without saving.

Because an org may have multiple SCM integrations, the repository dropdown must show repos grouped by integration. The `integrationId` of the chosen repo is recorded for use in subsequent API calls.

**Files:**

- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.tsx` (new) — modal component.
- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.tsx` — wire the `+ Connect repository` button to open the modal.
- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.spec.tsx` (new) — tests.

**Endpoints used:**

- `GET /organizations/{org}/integrations/?features[]=codeowners` (or filter by SCM provider) — to enumerate integrations and populate the dropdown groups.
- `GET /organizations/{org}/integrations/{integrationId}/repos/` — to list repos per integration; called for each integration when the user opens the dropdown.

**Tests:**

- Modal opens when `+ Connect repository` is clicked.
- Project name appears as a locked read-only field.
- Repository dropdown lists repos from the mock integrations.
- Paths area shows "Select a repository first…" before a repo is chosen.
- Save button is disabled before a repo is selected.
- Cancel closes the modal.

**Out of scope:** Path editor (M4/M5), saving (M6), editing pre-existing connections (M7).

**Depends on:** M1-1.

---

### M4 — Restore PathMapping component (Evan's work)

**Issue M4-1: Restore `PathMapping` component from Evan's merged PRs**

Re-introduce `static/app/components/connectRepository/pathMapping.tsx` from commit `53ec1cd084c` (the state after [#117191](https://github.com/getsentry/sentry/pull/117191) + [#117375](https://github.com/getsentry/sentry/pull/117375)). Restore the spec and stories alongside it.

Align field copy with the current Figma design where it diverges:

- The Figma uses "Stack trace prefix" / "Match" label and "Repository prefix" / "Replace with" label — confirm these match `#117375` copy and update if not.
- Collapsed summary shows `stackRoot → sourceRoot` with accent background; branch with `IconBranch`; expand and delete controls.
- The form's branch input: empty field displays placeholder `main`; invalid characters are slugified to `-` on type; trailing `.` or `/` stripped on blur.

Do not wire this into any page yet; it is a pure component restoration with a story.

**Files:**

- `static/app/components/connectRepository/pathMapping.tsx` (restore)
- `static/app/components/connectRepository/pathMapping.spec.tsx` (restore)
- `static/app/components/connectRepository/pathMapping.stories.tsx` (restore)
- `knip.config.ts` — re-add the story entry if it was removed with [#122986](https://github.com/getsentry/sentry/pull/122986).

**Tests:** Restore Evan's spec (164 lines at the time of deletion) and extend with any Figma-driven copy changes.

Key spec cases to preserve:

- Collapsed summary renders `[empty]` placeholder for empty roots.
- Expand toggle shows/hides the form.
- Summary row is hidden while `isNew && editing`.
- Branch defaults to `main` when empty.
- Invalid characters in branch are sanitized.
- Live preview updates as the user types.
- Trailing slash is normalised on blur.

**Out of scope:** List orchestration (M5), modal wiring (M6).

---

### M5 — Restore PathMappingList component (Evan's work)

**Issue M5-1: Restore and fix `PathMappingList` from [#117306](https://github.com/getsentry/sentry/pull/117306)**

Retrieve `static/app/components/connectRepository/pathMappingList.tsx` from the closed PR branch and fix the two Bugbot-flagged issues before merging:

**Bug 1 — stale closure in `handleChange` and `handleDelete`:**
Both functions build the next state from `entries` captured in the render closure. If two state updates happen before a re-render (e.g., rapid delete + edit) the second write overwrites the first. Fix by passing a functional update to `setEntries`:

```ts
// Before
const handleChange = (id, value) =>
  commit(entries.map(e => (e.id === id ? {...e, value} : e)));

// After
const handleChange = (id, value) =>
  setEntries(prev => {
    const next = prev.map(e => (e.id === id ? {...e, value} : e));
    onChange(next.map(e => e.value).filter(hasContent));
    return next;
  });
```

Apply the same pattern to `handleDelete`.

**Bug 2 — empty list after deleting last mapping:**
When the last entry is deleted, `remaining.length === 0` should seed a fresh open empty row (matching the mount behaviour), not commit an empty array. The PR branch already has this fix in a later commit; verify it is present.

Component behaviour to preserve:

- Seeds from `pathMappings` prop or one empty row when there are none.
- Only one row expanded at a time (`openId` state).
- "Add another path" re-opens the trailing empty row if it has no content yet, rather than appending another blank.
- Once a new row with content is collapsed its `isNew` flag is cleared.
- Duplicate detection uses `normalizedPathMappingSchema` (trailing-slash + `resolveBranch`), so `src/` and `src` are considered the same root.
- "Add another path" is disabled while a duplicate is unresolved.

**Files:**

- `static/app/components/connectRepository/pathMappingList.tsx` (restore + fix)
- `static/app/components/connectRepository/pathMappingList.spec.tsx` (restore)
- `static/app/components/connectRepository/pathMappingList.stories.tsx` (restore)

**Tests:** Evan's spec covers expand, add, remove, duplicate. Add:

- Rapid delete then edit does not surface stale entries in `onChange`.
- Deleting the last entry leaves exactly one open empty row.

**Out of scope:** Modal wiring (M6).

**Depends on:** M4-1.

---

### M6 — Connect modal: path editor, warnings, and persist

**Issue M6-1 ([VDY-220](https://linear.app/getsentry/issue/VDY-220)): Wire PathMappingList into the connect modal**

After a repository is selected, replace the "Select a repository first…" placeholder with `PathMappingList` seeded with one empty row. Save becomes enabled when the list has at least one non-empty valid path. Cancel closes without saving.

**Files:**

- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.tsx` — mount `PathMappingList` after repo selection, wire `onChange` to local state, enable/disable Save.
- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.spec.tsx` — extend tests.

**Tests:**

- `PathMappingList` appears after a repo is selected; placeholder is gone.
- `PathMappingList` is not visible before a repo is chosen.
- Save is disabled when the only row is empty; enabled when at least one path is valid.
- One-expanded-row and add-another-path behaviour from M5 still works in the modal.

**Out of scope:** Example preview (M6-3), warnings (M6-4), persist (M6-2).

**Depends on:** M5-1, M3-1.

---

**Issue M6-2 ([VDY-221](https://linear.app/getsentry/issue/VDY-221)): Persist the connection on Save**

On Save:

1. Call `POST /projects/{org}/{project}/repo/` with `{ repositoryId }`. This creates or upgrades the `ProjectRepository` row. The response returns `{ id, projectId, repositoryId, source, created }`.
2. For each non-empty path in the list, call `POST /organizations/{org}/code-mappings/` with `{ integrationId, repositoryId, projectId, stackRoot, sourceRoot, defaultBranch }`. These calls are independent; run them concurrently with `Promise.all`.
3. On success: close the modal, invalidate the `GET /code-mappings/` query so the panel row updates to show the new mapping count.
4. On error: surface the first API error message inline; keep the modal open.

Do **not** use the bulk endpoint (`/code-mappings/bulk/`) — it requires `org:ci` scope which is not available to regular product users.

**Files:**

- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.tsx` — add save mutation.
- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.spec.tsx` — extend tests.

**Endpoints used:**

- `POST /projects/{org}/{project}/repo/`
- `POST /organizations/{org}/code-mappings/` (one per path)

**Tests:**

- Save button disabled when the path list has no non-empty rows.
- On success: both API calls are made; modal closes; mapping count badge increments in the panel.
- On API error: error message is displayed inline; modal stays open.

**Depends on:** M6-1.

---

**Issue M6-3 ([VDY-236](https://linear.app/getsentry/issue/VDY-236)): Live path example in the expanded PathMapping form**

Align the **Example** panel in the expanded `PathMapping` form with the current Figma design. Evan's restored component (M4-1) already has a live preview; this ticket is about precise Figma alignment.

- Label: **Example** (bold, small).
- When `stackRoot` and `sourceRoot` are both non-empty: display a sample filename with the matched `stackRoot` portion highlighted and the rewritten filename with the `sourceRoot` portion highlighted (e.g. `src/views/index.tsx → src/app/views/index.tsx`).
- When `stackRoot` is empty (identity mapping): show `my/source.tsx → my/source.tsx` with muted copy **Linked as-is. The path is used exactly as it appears in the stack trace.**
- Updates live as the user types.

**Figma:** [node 3521:46700](https://www.figma.com/design/Bb7oTvPuL7OXL748s6kKp3/SCM---code-mapping?node-id=3521-46700), [node 8094:39498](https://www.figma.com/design/Bb7oTvPuL7OXL748s6kKp3/SCM---code-mapping?node-id=8094-39498).

**Files:** `static/app/components/connectRepository/pathMapping.tsx` (+ spec/stories).

**Tests:** rewrite example shows correct highlights; identity example shows "Linked as-is" copy; updates on field change; hidden when collapsed.

**Depends on:** M4-1, M6-1.

---

**Issue M6-4 ([VDY-237](https://linear.app/getsentry/issue/VDY-237)): Catch-all and overlap warnings (row-level and expanded alert)**

Client-side only, derived from the current `PathMappingList` state. Two warnings, each with up to two surfaces.

**Catch-all warning** — trigger: `stackRoot` is empty on the expanded row.

- Surface: info-level `Alert` inside the expanded form, below the Example panel.
- Copy: "A mapping that matches every path already exists, so this rule needs a specific path to match."

**Overlap warning** — trigger: a row's `stackRoot` is a string prefix of another row's `stackRoot` in the same list (normalised with `normalizedPathMappingSchema`).

- Surface A — collapsed summary row: warning triangle icon, amber background, `stackRoot → sourceRoot` text still shown.
- Surface B — expanded form: warning-level `Alert` below the Example panel. Copy: "/src/ is already mapped to /src/app/. Only the first match applies, so this one won't take effect." (interpolate actual values).

**Figma:** [node 3521:47790](https://www.figma.com/design/Bb7oTvPuL7OXL748s6kKp3/SCM---code-mapping?node-id=3521-47790), [node 3521:47028](https://www.figma.com/design/Bb7oTvPuL7OXL748s6kKp3/SCM---code-mapping?node-id=3521-47028), [node 3521:47583](https://www.figma.com/design/Bb7oTvPuL7OXL748s6kKp3/SCM---code-mapping?node-id=3521-47583).

**Files:** `pathMapping.tsx` (accept warning props), `pathMappingList.tsx` (derive and pass warnings), both specs.

**Tests:** catch-all Alert appears when `stackRoot` empty; overlap row-level warning on `src/` vs `src/app/`; expanded overlap Alert with interpolated copy; resolving the overlap clears the alert; no false positives.

**Depends on:** M6-1.

---

### M7 — Edit

**Issue M7-1: Edit existing connection from the panel overflow menu**

Enable the **Edit** item in the row overflow menu. It opens the same `ConnectRepositoryModal` but with both the project and repository fields locked (read-only). The `PathMappingList` is seeded from the current mappings for that `(project, repo)` pair, loaded from the already-cached `GET /code-mappings/` response.

On Save, diff the current list against the server state:

- **Added** (no `id`) — `POST /organizations/{org}/code-mappings/`
- **Changed** (has `id`, fields differ) — `PUT /organizations/{org}/code-mappings/{configId}/`
- **Removed** (was in server list, absent from submitted list) — `DELETE /organizations/{org}/code-mappings/{configId}/`

Removals that fail with 409 (CODEOWNERS protected) must surface a specific error: "This path mapping is used by a Code Owner rule and cannot be removed. Delete the Code Owner rule first."

After all mutations resolve, invalidate the `GET /code-mappings/` query.

**Files:**

- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.tsx` — add `mode: 'connect' | 'edit'` prop, lock fields in edit mode, prefill list, diff-save logic.
- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.tsx` — wire overflow Edit to open modal in edit mode.
- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.spec.tsx` — extend tests.

**Endpoints used:**

- `POST /organizations/{org}/code-mappings/`
- `PUT /organizations/{org}/code-mappings/{configId}/`
- `DELETE /organizations/{org}/code-mappings/{configId}/`

**Tests:**

- Edit opens the modal with both fields locked and paths prefilled from the mock `GET /code-mappings/` response.
- Adding a path issues a `POST`.
- Changing `stackRoot` on an existing path issues a `PUT`.
- Removing a path issues a `DELETE`.
- 409 on DELETE shows the CODEOWNERS error message; the rest of the save still completes.
- Panel mapping count updates after save.

**Depends on:** M6-1, M6-2.

---

### M8 — Disconnect

**Issue M8-1: Disconnect a repo from the panel overflow menu**

Enable the **Disconnect** item in the row overflow menu. It opens a confirm dialog (not the connect modal) with:

- **Header:** "Disconnect {repoName} from {projectName}?"
- **Still connected section** — list the other project slugs that also have mappings to the same repo (from the `GET /code-mappings/` response, filter by `repoId`, exclude the current project). Heading: "Still connected to this repository". If there are no other projects, omit this section.
- **Removing section** — list each path mapping that will be deleted: `stackRoot → sourceRoot | branch`. Heading: "Removing".
- **Body copy** — "This will also remove the {N} path mapping(s) between them. Stack traces in {projectName} will stop linking to {repoName}, and the suspect commits and source context that rely on it will stop."
- **Actions** — Cancel (no-op) and a destructive red **Disconnect** button.

On confirm, call `DELETE /organizations/{org}/code-mappings/{configId}/` for each mapping in the removing list. Run concurrently. On success, invalidate the `GET /code-mappings/` query; the row disappears from the panel.

Note: there is no `DELETE /projects/{org}/{project}/repo/` endpoint today. The `ProjectRepository` row is left in place. A follow-up issue (M8-2, not filed here) should evaluate whether to add a delete endpoint or whether leaving orphaned `ProjectRepository` rows is acceptable.

**Files:**

- `static/app/views/settings/projectGeneralSettings/disconnectRepositoryModal.tsx` (new) — confirm dialog.
- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.tsx` — wire overflow Disconnect to open the confirm dialog.
- `static/app/views/settings/projectGeneralSettings/disconnectRepositoryModal.spec.tsx` (new) — tests.

**Endpoints used:**

- `DELETE /organizations/{org}/code-mappings/{configId}/` (one per mapping)

**Tests:**

- Disconnect confirm shows the repo name and project name in the header.
- "Still connected" section lists other projects that share the same repo.
- "Removing" section lists each `stackRoot → sourceRoot` pair.
- Cancel closes without calling DELETE.
- Confirm calls DELETE for every mapping; row is removed from the panel after success.
- If one DELETE fails with 409 (CODEOWNERS), an error toast is shown; the dialog stays open.

**Depends on:** M2-1.

---

### M9 — Repository settings page (flipped modal)

**Issue M9-1: Wire the connect modal from the org Repositories page**

The org Repositories page (`static/app/views/settings/organizationRepositories/`) already has a `repoActions` prop on `ScmRepositoryTable` for a per-row action slot. Pass a `+` button as `repoActions` on repos with no connected projects for the current org, and an edit icon on repos that already have connections. Both open the same `ConnectRepositoryModal` but with the **repo locked** and the **project as the select field**.

The modal's `project` field becomes a searchable select of the org's projects. The rest of the flow (path editor, warnings, save, edit diff, disconnect) is identical to M3–M8 — the modal is shared code, not a duplicate.

**Files:**

- `static/app/views/settings/organizationRepositories/index.tsx` — pass `repoActions` to `ScmRepositoryTable` with `ConnectRepositoryModal` opened in `lockedSide: 'repo'` mode.
- `static/app/views/settings/projectGeneralSettings/connectRepositoryModal.tsx` — add `lockedSide: 'project' | 'repo'` prop; when `'repo'`, show a project selector instead of a project display.
- `static/app/views/settings/organizationRepositories/index.spec.tsx` — extend tests.

**Endpoints added (repo-locked path):**

- `GET /organizations/{org}/projects/` — to populate the project selector.

**Tests:**

- A `+` action appears on a repo row that has no connected projects.
- An edit action appears on a repo row that has at least one connected project.
- Clicking `+` opens the modal with the repo locked and the project as a selector.
- Selecting a project then saving calls `POST /projects/{org}/{project}/repo/` and `POST /code-mappings/`.
- The project chips on the repo row update after save.

**Depends on:** M6-2, M7-1, M8-1.

---

### M10 — All resolve health

Figma shows a green success tag on each Connected Repositories row, next to the mapping count: **✓ All resolve**. It means stack traces for this project actually link through this connection's path mappings — not that the mapping rows merely exist.

The design currently only shows the success state. Non-success copy/color is M10-3 and should be confirmed with design before shipping.

Do this after M9 so connect/edit/disconnect and the flipped Repositories modal are already in place.

**Issue M10-1: Compute resolve health for a project↔repo connection**

There is no health field on `RepositoryProjectPathConfig` today. `GET /projects/{org}/{project}/stacktrace-link/` already answers "does this filename resolve?" for one frame. Use that, do not invent a new table.

Add a small project-scoped helper/endpoint that:

1. Samples recent unique in-app stack filenames for the project (event stream or a bounded issues query — keep the sample size small and documented).
2. For each filename, runs the same match path as stacktrace-link (`get_sorted_code_mapping_configs` → first match wins).
3. Groups results by matched `repoId`.
4. Returns per-repo status: `all` | `partial` | `none` | `unknown` (unknown = no sample yet, or the query failed).

If a dedicated endpoint is too much for one PR, a frontend helper that fans out a bounded set of `GET .../stacktrace-link/?file=` calls is acceptable — but prefer one backend request so the panel does not N+1.

**Files (backend path):**

- New endpoint under `src/sentry/integrations/api/endpoints/` (or an extra field on `GET /code-mappings/?project=` if that stays cheap).
- Tests in `tests/sentry/integrations/api/endpoints/`.

**Endpoints used:**

- Existing `GET /projects/{org}/{project}/stacktrace-link/` as the match primitive.
- New `GET /projects/{org}/{project}/code-mapping-health/` (name TBD) **or** health nested on the code-mappings list.

**Tests:**

- All sampled filenames that match this repo's `stackRoot`s produce a source URL → `all`.
- Mix of matched and unmatched → `partial`.
- No filenames match this repo → `none`.
- Empty sample → `unknown`.
- Health for repo A is not affected by mappings that belong to repo B.

**Out of scope:** Rendering the tag (M10-2). Org Repositories page.

**Depends on:** M9-1 (surfaces exist), M2-1 (panel already lists connections).

**Issue M10-2: Render the All resolve tag on Connected Repositories rows**

On `connectedRepositoriesPanel.tsx`, next to `N mappings`, render the Figma tag: success `Tag` with a check icon and copy **All resolve**, only when health for that `repoId` is `all`. While health is loading, show a small skeleton in the tag slot (do not flash "All resolve"). If status is `unknown`, omit the tag.

Do **not** show partial/none styling here — that is M10-3.

**Files:**

- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.tsx`
- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.spec.tsx`

**Tests:**

- `all` → tag with check + "All resolve" is visible.
- Loading → skeleton in the tag slot; "All resolve" is not shown yet.
- `unknown` / missing health → no tag, mapping count still shows.
- Flag off still hides the whole panel (unchanged from M1).

**Out of scope:** Partial/none tags, org Repositories page, tooltip copy beyond a short default if design has not provided one.

**Depends on:** M10-1, M2-1.

**Issue M10-3: Non-success resolve states (confirm copy with design)**

Figma only designs **✓ All resolve**. Add the remaining states once design signs off:

- `partial` — warning tag (suggested copy: "Some unresolved" — **confirm**).
- `none` — danger/warning tag (suggested copy: "None resolve" — **confirm**).
- Tooltip explaining what was sampled (e.g. "Based on recent stack traces in this project").

Same tag slot on the project panel. If design also wants this on the org Repositories page, add it there in this PR using the same health payload — do not duplicate the compute logic.

**Files:**

- `static/app/views/settings/projectGeneralSettings/connectedRepositoriesPanel.tsx`
- Optionally `static/app/views/settings/organizationRepositories/components/scmRepositoryTable.tsx` if design includes it.
- Specs for both surfaces touched.

**Tests:**

- `partial` and `none` render the agreed tags.
- `all` still renders as in M10-2.
- Tooltip is present and does not claim 100% of historical events if the sample is bounded.

**Depends on:** M10-2.

---

### M11 — Stretch: autocomplete for stack/source prefixes

No issues are filed for this milestone yet. The idea is to suggest `stackRoot` and `sourceRoot` values by querying the derive-code-mappings endpoint (`GET /organizations/{org}/derive-code-mappings/?stacktraceFilename=...`) against recent event data for the project, and surfacing the top suggestions as a typeahead in the PathMapping form fields.

This will be broken into issues once M6–M10 are stable.

---

## Out of scope in this document

- **Cutover (remove integration Code Mappings tab)** — deferred. The old tab stays until the new surfaces are proven and the flag is fully rolled out.
- **Autocomplete tickets** — described in M11 as a stretch goal only.
- **Seer project repository settings** — separate project; the `SeerProjectRepository` model is not touched here.
