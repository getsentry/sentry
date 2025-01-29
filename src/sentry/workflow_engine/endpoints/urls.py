from django.urls import re_path

from .organization_workflow_index import OrganizationWorkflowIndexEndpoint
from .project_detector_details import ProjectDetectorDetailsEndpoint
from .project_detector_index import ProjectDetectorIndexEndpoint

# TODO @saponifi3d - Add the remaining API endpoints

# Remaining Detector Endpoints
#   - GET /detector w/ filters
#   - GET /detector/:id
#   - PUT /detector/:id
#   - DELETE /detector/:id

# Remaining Workflows Endpoints
# - GET /workflow w/ filters
# - POST /workflow
# - GET /workflow/:id
# - PUT /workflow/:id
# - DELETE /workflow/:id

project_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^\/]+)/(?P<project_id_or_slug>[^\/]+)/detectors/$",
        ProjectDetectorIndexEndpoint.as_view(),
        name="sentry-api-0-project-detector-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^\/]+)/(?P<project_id_or_slug>[^\/]+)/detectors/(?P<detector_id>[^\/]+)/$",
        ProjectDetectorDetailsEndpoint.as_view(),
        name="sentry-api-0-project-detector-details",
    ),
]

organization_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^\/]+)/workflows/$",
        OrganizationWorkflowIndexEndpoint.as_view(),
        name="sentry-api-0-organization-workflow-index",
    ),
]
