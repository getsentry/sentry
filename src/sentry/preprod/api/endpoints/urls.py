from django.urls import re_path

from .organization_preprod_artifact_assemble import ProjectPreprodArtifactAssembleEndpoint
from .preprod_artifact_admin_batch_delete import PreprodArtifactAdminBatchDeleteEndpoint
from .preprod_artifact_admin_info import PreprodArtifactAdminInfoEndpoint
from .preprod_artifact_admin_rerun_analysis import PreprodArtifactAdminRerunAnalysisEndpoint
from .project_installable_preprod_artifact_download import (
    ProjectInstallablePreprodArtifactDownloadEndpoint,
)
from .project_preprod_artifact_assemble_generic import ProjectPreprodArtifactAssembleGenericEndpoint
from .project_preprod_artifact_download import ProjectPreprodArtifactDownloadEndpoint
from .project_preprod_artifact_install_details import ProjectPreprodInstallDetailsEndpoint
from .project_preprod_artifact_size_analysis_download import (
    ProjectPreprodArtifactSizeAnalysisDownloadEndpoint,
)
from .project_preprod_artifact_update import ProjectPreprodArtifactUpdateEndpoint
from .project_preprod_build_details import ProjectPreprodBuildDetailsEndpoint
from .project_preprod_check_for_updates import ProjectPreprodArtifactCheckForUpdatesEndpoint
from .project_preprod_list_builds import ProjectPreprodListBuildsEndpoint

preprod_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/assemble/$",
        ProjectPreprodArtifactAssembleEndpoint.as_view(),
        name="sentry-api-0-assemble-preprod-artifact-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/check-for-updates/$",
        ProjectPreprodArtifactCheckForUpdatesEndpoint.as_view(),
        name="sentry-api-0-project-preprod-check-for-updates",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/list-builds/$",
        ProjectPreprodListBuildsEndpoint.as_view(),
        name="sentry-api-0-project-preprod-list-builds",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<artifact_id>[^/]+)/size-analysis/$",
        ProjectPreprodArtifactSizeAnalysisDownloadEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-size-analysis-download",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/(?P<artifact_id>[^/]+)/build-details/$",
        ProjectPreprodBuildDetailsEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-build-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/preprodartifacts/(?P<artifact_id>[^/]+)/install-details/$",
        ProjectPreprodInstallDetailsEndpoint.as_view(),
        name="sentry-api-0-project-preprod-install-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/installablepreprodartifact/(?P<url_path>[^/]+)/$",
        ProjectInstallablePreprodArtifactDownloadEndpoint.as_view(),
        name="sentry-api-0-installable-preprod-artifact-download",
    ),
]

preprod_internal_urlpatterns = [
    re_path(
        r"^preprod-artifact/rerun-analysis/$",
        PreprodArtifactAdminRerunAnalysisEndpoint.as_view(),
        name="sentry-admin-preprod-artifact-rerun-analysis",
    ),
    re_path(
        r"^preprod-artifact/(?P<preprod_artifact_id>[^/]+)/info/$",
        PreprodArtifactAdminInfoEndpoint.as_view(),
        name="sentry-admin-preprod-artifact-info",
    ),
    re_path(
        r"^preprod-artifact/batch-delete/$",
        PreprodArtifactAdminBatchDeleteEndpoint.as_view(),
        name="sentry-admin-preprod-artifact-batch-delete",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<artifact_id>[^/]+)/$",
        ProjectPreprodArtifactDownloadEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-download",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<artifact_id>[^/]+)/update/$",
        ProjectPreprodArtifactUpdateEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-update",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<artifact_id>[^/]+)/assemble-generic/$",
        ProjectPreprodArtifactAssembleGenericEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-assemble-generic",
    ),
]
