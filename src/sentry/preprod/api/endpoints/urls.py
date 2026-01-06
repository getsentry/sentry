from __future__ import annotations

from django.urls import re_path

from sentry.preprod.api.endpoints.project_preprod_artifact_image import (
    ProjectPreprodArtifactImageEndpoint,
)
from sentry.preprod.api.endpoints.size_analysis.project_preprod_size_analysis_compare import (
    ProjectPreprodArtifactSizeAnalysisCompareEndpoint,
)
from sentry.preprod.api.endpoints.size_analysis.project_preprod_size_analysis_compare_download import (
    ProjectPreprodArtifactSizeAnalysisCompareDownloadEndpoint,
)
from sentry.preprod.api.endpoints.size_analysis.project_preprod_size_analysis_download import (
    ProjectPreprodArtifactSizeAnalysisDownloadEndpoint,
)

from .organization_preprod_app_size_stats import OrganizationPreprodAppSizeStatsEndpoint
from .organization_preprod_artifact_assemble import ProjectPreprodArtifactAssembleEndpoint
from .organization_preprod_list_builds import OrganizationPreprodListBuildsEndpoint
from .preprod_artifact_admin_batch_delete import PreprodArtifactAdminBatchDeleteEndpoint
from .preprod_artifact_admin_info import PreprodArtifactAdminInfoEndpoint
from .preprod_artifact_rerun_analysis import (
    PreprodArtifactAdminRerunAnalysisEndpoint,
    PreprodArtifactRerunAnalysisEndpoint,
)
from .preprod_artifact_rerun_status_checks import PreprodArtifactRerunStatusChecksEndpoint
from .preprod_artifact_snapshot import ProjectPreprodSnapshotEndpoint
from .project_installable_preprod_artifact_download import (
    ProjectInstallablePreprodArtifactDownloadEndpoint,
)
from .project_preprod_artifact_assemble_generic import ProjectPreprodArtifactAssembleGenericEndpoint
from .project_preprod_artifact_delete import ProjectPreprodArtifactDeleteEndpoint
from .project_preprod_artifact_download import ProjectPreprodArtifactDownloadEndpoint
from .project_preprod_artifact_install_details import ProjectPreprodInstallDetailsEndpoint
from .project_preprod_artifact_update import ProjectPreprodArtifactUpdateEndpoint
from .project_preprod_build_details import ProjectPreprodBuildDetailsEndpoint
from .project_preprod_check_for_updates import ProjectPreprodArtifactCheckForUpdatesEndpoint
from .project_preprod_size import (
    ProjectPreprodSizeEndpoint,
    ProjectPreprodSizeWithIdentifierEndpoint,
)
from .pull_request.organization_pullrequest_comments import OrganizationPrCommentsEndpoint
from .pull_request.organization_pullrequest_details import OrganizationPullRequestDetailsEndpoint
from .pull_request.organization_pullrequest_size_analysis_download import (
    OrganizationPullRequestSizeAnalysisDownloadEndpoint,
)

__all__ = [
    "preprod_project_urlpatterns",
    "preprod_organization_urlpatterns",
    "preprod_internal_urlpatterns",
]

preprod_project_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/assemble/$",
        ProjectPreprodArtifactAssembleEndpoint.as_view(),
        name="sentry-api-0-assemble-preprod-artifact-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/snapshots/$",
        ProjectPreprodSnapshotEndpoint.as_view(),
        name="sentry-api-0-project-preprod-snapshots-create",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/snapshots/(?P<snapshot_id>[^/]+)/$",
        ProjectPreprodSnapshotEndpoint.as_view(),
        name="sentry-api-0-project-preprod-snapshots-detail",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/check-for-updates/$",
        ProjectPreprodArtifactCheckForUpdatesEndpoint.as_view(),
        name="sentry-api-0-project-preprod-check-for-updates",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<head_artifact_id>[^/]+)/size-analysis/$",
        ProjectPreprodArtifactSizeAnalysisDownloadEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-size-analysis-download",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/(?P<head_artifact_id>[^/]+)/build-details/$",
        ProjectPreprodBuildDetailsEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-build-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/(?P<head_artifact_id>[^/]+)/install-details/$",
        ProjectPreprodInstallDetailsEndpoint.as_view(),
        name="sentry-api-0-project-preprod-install-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/(?P<head_artifact_id>[^/]+)/delete/$",
        ProjectPreprodArtifactDeleteEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-delete",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/installablepreprodartifact/(?P<url_path>[^/]+)/$",
        ProjectInstallablePreprodArtifactDownloadEndpoint.as_view(),
        name="sentry-api-0-installable-preprod-artifact-download",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/images/(?P<image_id>[^/]+)/$",
        ProjectPreprodArtifactImageEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-image",
    ),
    # Size analysis
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/size-analysis/compare/(?P<head_artifact_id>[^/]+)/(?P<base_artifact_id>[^/]+)/$",
        ProjectPreprodArtifactSizeAnalysisCompareEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-size-analysis-compare",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/size-analysis/compare/(?P<head_size_metric_id>[^/]+)/(?P<base_size_metric_id>[^/]+)/download/$",
        ProjectPreprodArtifactSizeAnalysisCompareDownloadEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-size-analysis-compare-download",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprod-artifact/rerun-analysis/(?P<head_artifact_id>[^/]+)/$",
        PreprodArtifactRerunAnalysisEndpoint.as_view(),
        name="sentry-api-0-preprod-artifact-rerun-analysis",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprod-artifact/rerun-status-checks/(?P<head_artifact_id>[^/]+)/$",
        PreprodArtifactRerunStatusChecksEndpoint.as_view(),
        name="sentry-api-0-preprod-artifact-rerun-status-checks",
    ),
]

preprod_organization_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/preprod/app-size-stats/$",
        OrganizationPreprodAppSizeStatsEndpoint.as_view(),
        name="sentry-api-0-organization-preprod-app-size-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/preprodartifacts/list-builds/$",
        OrganizationPreprodListBuildsEndpoint.as_view(),
        name="sentry-api-0-organization-preprod-list-builds",
    ),
    # PR page
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/pullrequest-details/(?P<repo_name>.+?)/(?P<pr_number>\d+)/$",
        OrganizationPullRequestDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-pullrequest-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/pull-requests/size-analysis/(?P<artifact_id>[^/]+)/$",
        OrganizationPullRequestSizeAnalysisDownloadEndpoint.as_view(),
        name="sentry-api-0-organization-pullrequest-size-analysis-download",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/pr-comments/(?P<repo_name>.+?)/(?P<pr_number>\d+)/$",
        OrganizationPrCommentsEndpoint.as_view(),
        name="sentry-api-0-organization-pr-comments",
    ),
]

preprod_internal_urlpatterns = [
    re_path(
        r"^preprod-artifact/rerun-analysis/$",
        PreprodArtifactAdminRerunAnalysisEndpoint.as_view(),
        name="sentry-admin-preprod-artifact-rerun-analysis",
    ),
    re_path(
        r"^preprod-artifact/(?P<head_artifact_id>[^/]+)/info/$",
        PreprodArtifactAdminInfoEndpoint.as_view(),
        name="sentry-admin-preprod-artifact-info",
    ),
    re_path(
        r"^preprod-artifact/batch-delete/$",
        PreprodArtifactAdminBatchDeleteEndpoint.as_view(),
        name="sentry-admin-preprod-artifact-batch-delete",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<head_artifact_id>[^/]+)/$",
        ProjectPreprodArtifactDownloadEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-download",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<head_artifact_id>[^/]+)/update/$",
        ProjectPreprodArtifactUpdateEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-update",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<head_artifact_id>[^/]+)/assemble-generic/$",
        ProjectPreprodArtifactAssembleGenericEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-assemble-generic",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<head_artifact_id>[^/]+)/size/$",
        ProjectPreprodSizeEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-size",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<head_artifact_id>[^/]+)/size/(?P<identifier>[^/]+)/$",
        ProjectPreprodSizeWithIdentifierEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-size-identifier",
    ),
]
