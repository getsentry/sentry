from django.urls import re_path

from .organization_alertrule_detector_index import OrganizationAlertRuleDetectorIndexEndpoint
from .organization_alertrule_workflow_index import OrganizationAlertRuleWorkflowIndexEndpoint
from .organization_available_action_index import OrganizationAvailableActionIndexEndpoint
from .organization_data_condition_index import OrganizationDataConditionIndexEndpoint
from .organization_detector_anomaly_data import OrganizationDetectorAnomalyDataEndpoint
from .organization_detector_count import OrganizationDetectorCountEndpoint
from .organization_detector_details import OrganizationDetectorDetailsEndpoint
from .organization_detector_index import OrganizationDetectorIndexEndpoint
from .organization_detector_types import OrganizationDetectorTypeIndexEndpoint
from .organization_incident_groupopenperiod_index import (
    OrganizationIncidentGroupOpenPeriodIndexEndpoint,
)
from .organization_open_periods import OrganizationOpenPeriodsEndpoint
from .organization_test_fire_action import OrganizationTestFireActionsEndpoint
from .organization_workflow_details import OrganizationWorkflowDetailsEndpoint
from .organization_workflow_group_history import OrganizationWorkflowGroupHistoryEndpoint
from .organization_workflow_index import OrganizationWorkflowIndexEndpoint
from .organization_workflow_stats import OrganizationWorkflowStatsEndpoint

# TODO @saponifi3d - Add the remaining API endpoints

# Remaining Detector Endpoints
#   - GET /detector w/ filters

# Remaining Workflows Endpoints
# - GET /workflow w/ filters
# - POST /workflow
# - PUT /workflow/:id
# - DELETE /workflow/:id

organization_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/detectors/(?P<detector_id>\d+)/$",
        OrganizationDetectorDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-detector-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/detectors/(?P<detector_id>[^/]+)/anomaly-data/$",
        OrganizationDetectorAnomalyDataEndpoint.as_view(),
        name="sentry-api-0-organization-detector-anomaly-data",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/workflows/$",
        OrganizationWorkflowIndexEndpoint.as_view(),
        name="sentry-api-0-organization-workflow-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/detectors/$",
        OrganizationDetectorIndexEndpoint.as_view(),
        name="sentry-api-0-organization-detector-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/detectors/count/$",
        OrganizationDetectorCountEndpoint.as_view(),
        name="sentry-api-0-organization-detector-count",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/workflows/(?P<workflow_id>\d+)/$",
        OrganizationWorkflowDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-workflow-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/workflows/(?P<workflow_id>\d+)/group-history/$",
        OrganizationWorkflowGroupHistoryEndpoint.as_view(),
        name="sentry-api-0-organization-workflow-group-history",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/workflows/(?P<workflow_id>[^/]+)/stats/$",
        OrganizationWorkflowStatsEndpoint.as_view(),
        name="sentry-api-0-organization-workflow-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/data-conditions/$",
        OrganizationDataConditionIndexEndpoint.as_view(),
        name="sentry-api-0-organization-data-condition-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/detector-types/$",
        OrganizationDetectorTypeIndexEndpoint.as_view(),
        name="sentry-api-0-organization-detector-type-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/available-actions/$",
        OrganizationAvailableActionIndexEndpoint.as_view(),
        name="sentry-api-0-organization-available-action-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/test-fire-actions/$",
        OrganizationTestFireActionsEndpoint.as_view(),
        name="sentry-api-0-organization-test-fire-actions",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/open-periods/$",
        OrganizationOpenPeriodsEndpoint.as_view(),
        name="sentry-api-0-organization-open-periods",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/alert-rule-workflow/$",
        OrganizationAlertRuleWorkflowIndexEndpoint.as_view(),
        name="sentry-api-0-organization-alert-rule-workflow-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/alert-rule-detector/$",
        OrganizationAlertRuleDetectorIndexEndpoint.as_view(),
        name="sentry-api-0-organization-alert-rule-detector-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incident-groupopenperiod/$",
        OrganizationIncidentGroupOpenPeriodIndexEndpoint.as_view(),
        name="sentry-api-0-organization-incident-groupopenperiod-index",
    ),
]
