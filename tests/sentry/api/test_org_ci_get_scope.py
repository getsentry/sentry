"""Deterministic guardrail for the `org:ci` scope on GET endpoints.

`org:ci` is carried by organization auth tokens used for CI automation (e.g.
sentry-cli): creating releases and uploading debug files, source maps, and
preprod/suspect-commit artifacts. It must NOT let a CI token *read or enumerate*
a project's stored artifacts (debug-file / source-map / artifact-bundle catalogs).

This test freezes the full set of endpoints whose GET is reachable by an `org:ci`
token. It fails whenever that surface changes, forcing a conscious review:

- Adding an endpoint that only *lists or reads* uploaded artifacts? Use a
  read-restricted permission whose GET omits `org:ci`
  (`ProjectReleaseArtifactReadPermission` / `OrganizationReleaseArtifactReadPermission`)
  instead of `ProjectReleasePermission` / `OrganizationReleasePermission` — then it
  won't appear here at all.
- Genuinely need `org:ci` GET (an upload-support read, release management)? Add the
  endpoint to the allowlist below in the same PR.

Replaces the file-scoped LLM `grantsCiScopeToArtifactCatalog` rule, which could not
reliably localize a single over-permissioned endpoint among its siblings.
"""

from django.urls import get_resolver

from sentry.api.endpoint_owners import get_endpoint_classes_from_url_patterns

# Endpoints whose GET is intentionally reachable by an `org:ci` org-auth-token.
# Keep sorted. See module docstring before adding an entry.
ORG_CI_GET_ALLOWLIST: frozenset[str] = frozenset(
    {
        # --- Upload / assemble / dedup: the CI write-support flow ---
        "sentry.api.endpoints.chunk.ChunkUploadEndpoint",
        "sentry.api.endpoints.debug_files.AssociateDSymFilesEndpoint",
        "sentry.api.endpoints.debug_files.DifAssembleEndpoint",
        "sentry.api.endpoints.debug_files.UnknownDebugFilesEndpoint",
        "sentry.api.endpoints.organization_artifactbundle_assemble.OrganizationArtifactBundleAssembleEndpoint",
        "sentry.releases.endpoints.organization_release_assemble.OrganizationReleaseAssembleEndpoint",
        "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble.ProjectPreprodArtifactAssembleEndpoint",
        # --- Release / deploy management: CI legitimately creates & reads releases ---
        "sentry.api.endpoints.filechange.CommitFileChangeEndpoint",
        "sentry.api.endpoints.organization_releases.OrganizationReleasesEndpoint",
        "sentry.api.endpoints.organization_releases.OrganizationReleasesStatsEndpoint",
        "sentry.api.endpoints.project_commits.ProjectCommitsEndpoint",
        "sentry.api.endpoints.project_reprocessing.ProjectReprocessingEndpoint",
        "sentry.api.endpoints.release_thresholds.release_threshold.ReleaseThresholdEndpoint",
        "sentry.api.endpoints.release_thresholds.release_threshold_details.ReleaseThresholdDetailsEndpoint",
        "sentry.api.endpoints.release_thresholds.release_threshold_status_index.ReleaseThresholdStatusIndexEndpoint",
        "sentry.issues.endpoints.organization_release_previous_commits.OrganizationReleasePreviousCommitsEndpoint",
        "sentry.releases.endpoints.organization_release_commits.OrganizationReleaseCommitsEndpoint",
        "sentry.releases.endpoints.organization_release_details.OrganizationReleaseDetailsEndpoint",
        "sentry.releases.endpoints.organization_release_meta.OrganizationReleaseMetaEndpoint",
        "sentry.releases.endpoints.project_release_commits.ProjectReleaseCommitsEndpoint",
        "sentry.releases.endpoints.project_release_details.ProjectReleaseDetailsEndpoint",
        "sentry.releases.endpoints.project_release_repositories.ProjectReleaseRepositories",
        "sentry.releases.endpoints.project_release_setup.ProjectReleaseSetupCompletionEndpoint",
        "sentry.releases.endpoints.project_release_stats.ProjectReleaseStatsEndpoint",
        "sentry.releases.endpoints.project_releases.ProjectReleasesEndpoint",
        "sentry.releases.endpoints.release_deploys.ReleaseDeploysEndpoint",
        # --- Repository / code-mapping / integrations (repo-content; also covered by
        #     the decisionModelLinter grantsCiScopeToRepositoryContent rule) ---
        "sentry.integrations.api.endpoints.organization_code_mapping_details.OrganizationCodeMappingDetailsEndpoint",
        "sentry.integrations.api.endpoints.organization_code_mappings.OrganizationCodeMappingsEndpoint",
        "sentry.integrations.api.endpoints.organization_code_mappings_bulk.OrganizationCodeMappingsBulkEndpoint",
        "sentry.integrations.api.endpoints.organization_repositories.OrganizationRepositoriesEndpoint",
        "sentry.issues.endpoints.organization_derive_code_mappings.OrganizationDeriveCodeMappingsEndpoint",
        # --- Preprod (emerge-tools): upload/approve/snapshot reads ---
        "sentry.preprod.api.endpoints.preprod_artifact_approve.OrganizationPreprodArtifactApproveEndpoint",
        "sentry.preprod.api.endpoints.project_preprod_artifact_image.ProjectPreprodArtifactImageEndpoint",
        "sentry.preprod.api.endpoints.project_preprod_upload_options.ProjectPreprodUploadOptionsEndpoint",
        "sentry.preprod.api.endpoints.public.project_preprod_skip_status_check.ProjectPreprodSizeAnalysisSkipStatusCheckEndpoint",
        "sentry.preprod.api.endpoints.public.project_preprod_skip_status_check.ProjectPreprodSnapshotSkipStatusCheckEndpoint",
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.OrganizationPreprodSnapshotEndpoint",
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.ProjectPreprodSnapshotEndpoint",
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_archive.OrganizationPreprodSnapshotArchiveEndpoint",
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_image_detail.OrganizationPreprodSnapshotImageDetailEndpoint",
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_latest_base.OrganizationPreprodLatestBaseSnapshotEndpoint",
        # --- Pending owner review (org:ci GET of artifact data; tracked separately) ---
        # artifact_lookup: symbolication lookup-for-download, download byte-gated (ingest)
        "sentry.api.endpoints.artifact_lookup.ProjectArtifactLookupEndpoint",
        # proguard releases: lookup by proguard_uuid (ingest, borderline)
        "sentry.api.endpoints.debug_files.ProguardArtifactReleasesEndpoint",
        # single-artifact-by-id metadata reads (not catalog enumeration)
        "sentry.api.endpoints.project_artifact_bundle_file_details.ProjectArtifactBundleFileDetailsEndpoint",
        "sentry.releases.endpoints.organization_release_file_details.OrganizationReleaseFileDetailsEndpoint",
        "sentry.releases.endpoints.project_release_file_details.ProjectReleaseFileDetailsEndpoint",
    }
)


def _org_ci_get_endpoints() -> set[str]:
    """Every API endpoint whose GET is reachable by an org:ci org-auth-token."""
    classes = get_endpoint_classes_from_url_patterns(get_resolver().url_patterns)
    out: set[str] = set()
    for cls in classes:
        for perm in getattr(cls, "permission_classes", ()) or ():
            scope_map = getattr(perm, "scope_map", None)
            if isinstance(scope_map, dict) and "org:ci" in (scope_map.get("GET") or ()):
                out.add(f"{cls.__module__}.{cls.__qualname__}")
                break
    return out


def test_org_ci_get_scope_allowlist() -> None:
    actual = _org_ci_get_endpoints()
    newly_exposed = actual - ORG_CI_GET_ALLOWLIST
    no_longer_exposed = ORG_CI_GET_ALLOWLIST - actual
    assert not newly_exposed, (
        "These endpoints newly expose GET to an `org:ci` token. If an endpoint only "
        "lists/reads uploaded artifacts, use ProjectReleaseArtifactReadPermission / "
        "OrganizationReleaseArtifactReadPermission (GET omits org:ci). If org:ci GET is "
        "intended, add it to ORG_CI_GET_ALLOWLIST in this file.\n"
        f"{sorted(newly_exposed)}"
    )
    assert not no_longer_exposed, (
        "These endpoints no longer expose GET to `org:ci` (good) — remove them from "
        f"ORG_CI_GET_ALLOWLIST:\n{sorted(no_longer_exposed)}"
    )
