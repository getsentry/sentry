from django.urls import re_path

from .organization_preprod_artifact_assemble import ProjectPreprodArtifactAssembleEndpoint
from .project_preprod_artifact_assemble_generic import ProjectPreprodArtifactAssembleGenericEndpoint
from .project_preprod_artifact_download import ProjectPreprodArtifactDownloadEndpoint
from .project_preprod_artifact_size_analysis_download import (
    ProjectPreprodArtifactSizeAnalysisDownloadEndpoint,
)
from .project_preprod_artifact_update import ProjectPreprodArtifactUpdateEndpoint

preprod_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/assemble/$",
        ProjectPreprodArtifactAssembleEndpoint.as_view(),
        name="sentry-api-0-assemble-preprod-artifact-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<artifact_id>[^/]+)/size-analysis/$",
        ProjectPreprodArtifactSizeAnalysisDownloadEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-size-analysis-download",
    ),
]

preprod_internal_urlpatterns = [
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
