from django.urls import re_path

from .organization_preprod_artifact_assemble import ProjectPreprodArtifactAssembleEndpoint
from .project_preprod_artifact_download import ProjectPreprodArtifactDownloadEndpoint

preprod_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/assemble/$",
        ProjectPreprodArtifactAssembleEndpoint.as_view(),
        name="sentry-api-0-assemble-preprod-artifact-files",
    ),
]

preprod_internal_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/preprodartifacts/(?P<artifact_id>[^/]+)/$",
        ProjectPreprodArtifactDownloadEndpoint.as_view(),
        name="sentry-api-0-project-preprod-artifact-download",
    ),
]
