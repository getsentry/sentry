from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.incidents.endpoints.bases import WorkflowEngineProjectAlertRuleEndpoint
from sentry.incidents.endpoints.organization_alert_rule_details import (
    fetch_alert_rule,
    remove_alert_rule,
    update_alert_rule,
)
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.project import Project
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.utils.legacy_metric_tracking import track_alert_endpoint_execution


@cell_silo_endpoint
class ProjectAlertRuleDetailsEndpoint(WorkflowEngineProjectAlertRuleEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }

    @track_alert_endpoint_execution("GET", "sentry-api-0-project-alert-rule-details")
    def get(self, request: Request, project: Project, alert_rule: AlertRule | Detector) -> Response:
        """
        Fetch a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return fetch_alert_rule(request, project.organization, alert_rule)

    @track_alert_endpoint_execution("PUT", "sentry-api-0-project-alert-rule-details")
    def put(self, request: Request, project: Project, alert_rule: AlertRule | Detector) -> Response:
        """
        Update a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return update_alert_rule(request, project.organization, alert_rule)

    @track_alert_endpoint_execution("DELETE", "sentry-api-0-project-alert-rule-details")
    def delete(
        self, request: Request, project: Project, alert_rule: AlertRule | Detector
    ) -> Response:
        """
        Delete a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return remove_alert_rule(request, project.organization, alert_rule)
