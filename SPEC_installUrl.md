# Spec: Return `installUrl` from preprod artifact assemble endpoint

Companion change for sentry-cli issue [#3292](https://github.com/getsentry/sentry-cli/issues/3292).
Adds an `installUrl` field to the assemble response so `sentry-cli build upload` can surface
the install page directly without scraping stdout or making a follow-up request.

## Goal

After a successful chunk-assemble, return the install page URL in the same response that already
returns `artifactUrl`. Additive change only — no removals, no field renames.

## Scope

**In scope (this PR):**
- Add `installUrl` to the `CREATED`-state success response of `ProjectPreprodArtifactAssembleEndpoint`.

**Out of scope (deliberately deferred):**
- `itms-services://` manifest URL. It depends on `InstallablePreprodArtifact.url_path`, which is
  created asynchronously by `assemble_preprod_artifact_installable_app` *after* assemble returns.
  At response time the row does not exist yet. Three possible follow-ups, none belong here:
  1. CLI/clients hit the install page, which already serves the QR/itms link.
  2. CLI/clients follow up with `GET .../files/installablepreprodartifact/?per_page=1`.
  3. Pre-create `InstallablePreprodArtifact` synchronously (bigger change; needs Emerge Tools sign-off).
- Adding the field to `NOT_FOUND` / missing-chunks branches. Those responses fire before an
  artifact row exists, so there's nothing to link to.

## Files to change

### 1. `src/sentry/preprod/api/endpoints/organization_preprod_artifact_assemble.py`

At the end of `post()` the response is built inline:

```python
artifact_url = get_preprod_artifact_url(artifact)

return Response(
    {
        "state": ChunkFileState.CREATED,
        "missingChunks": [],
        "artifactUrl": artifact_url,
    }
)
```

Change to:

```python
artifact_url = get_preprod_artifact_url(artifact)
install_url = get_preprod_artifact_url(artifact, view_type="install")

return Response(
    {
        "state": ChunkFileState.CREATED,
        "missingChunks": [],
        "artifactUrl": artifact_url,
        "installUrl": install_url,
    }
)
```

`get_preprod_artifact_url` already supports `view_type="install"` (see `src/sentry/preprod/url_utils.py`),
so no helper changes are needed.

### 2. `tests/sentry/preprod/api/endpoints/test_organization_preprod_artifact_assemble.py`

Update the success-path tests to assert the new field. Find the test(s) that check
`response.data["artifactUrl"]` and add an analogous assertion for `response.data["installUrl"]`.

Expected install URL format:
`https://<org>.sentry.io/organizations/<slug>/preprod/install/<artifact_id>`
(absolute URL is region/customer-domain aware via `organization.absolute_url`.)

### 3. (Optional) `src/sentry/apidocs/examples/preprod_examples.py`

If the assemble endpoint has an example response in this file, add `installUrl` to it. The file
already references `installUrl` for other endpoints — match that wording for consistency.
If the assemble endpoint isn't documented here, skip.

## Non-goals / things NOT to touch

- Do **not** change `artifactUrl` (callers depend on it).
- Do **not** rename `get_preprod_artifact_url` or its `view_type` enum.
- Do **not** add the field to error responses (`ChunkFileState.ERROR`, `NOT_FOUND`) — no artifact exists.
- Do **not** modify the async `assemble_preprod_artifact` task or `InstallablePreprodArtifact` model.

## Verification

1. Run the assemble endpoint tests:
   ```
   pytest tests/sentry/preprod/api/endpoints/test_organization_preprod_artifact_assemble.py -v
   ```
2. Confirm the `installUrl` value matches `/organizations/<slug>/preprod/install/<artifact_id>` with
   the org's absolute URL prefix.
3. Confirm `artifactUrl` is unchanged.

## Commit / PR

- Endpoint owner: `ApiOwner.EMERGE_TOOLS` — tag that team on review.
- Publish status: `EXPERIMENTAL` — additive changes are low-risk but still keep the diff tight.
- Suggested commit subject: `feat(preprod): Return installUrl from artifact assemble endpoint`
- PR description should link sentry-cli #3292 and note this unblocks `sentry-cli build upload`
  surfacing the install URL.

## Reference: how sentry-cli will consume this

For context only — no CLI changes in this PR. After this lands, sentry-cli will:
1. Add `install_url: Option<String>` to `AssembleBuildResponse` in `src/api/data_types/chunking/build.rs`.
2. Surface it in human output and in the planned `--output-format json` output (issue #3292).
