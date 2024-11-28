from django.urls import re_path

from .project_detector_index import ProjectDetectorIndexEndpoint

urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^\/]+)/(?P<project_id_or_slug>[^\/]+)/detectors/$",
        ProjectDetectorIndexEndpoint.as_view(),
        name="sentry-api-0-project-detector-index",
    ),
]
