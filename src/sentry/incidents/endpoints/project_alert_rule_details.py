from typing import int
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.incidents.endpoints.bases import ProjectAlertRuleEndpoint
from sentry.incidents.endpoints.organization_alert_rule_details import (
    fetch_alert_rule,
    remove_alert_rule,
    update_alert_rule,
)
from sentry.workflow_engine.utils.legacy_metric_tracking import track_alert_endpoint_execution


@region_silo_endpoint
class ProjectAlertRuleDetailsEndpoint(ProjectAlertRuleEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }

    @track_alert_endpoint_execution("GET", "sentry-api-0-project-alert-rule-details")
    def get(self, request: Request, project, alert_rule) -> Response:
        """
        Fetch a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return fetch_alert_rule(request, project.organization, alert_rule)

    @track_alert_endpoint_execution("PUT", "sentry-api-0-project-alert-rule-details")
    def put(self, request: Request, project, alert_rule) -> Response:
        """
        Update a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return update_alert_rule(request, project.organization, alert_rule)

    @track_alert_endpoint_execution("DELETE", "sentry-api-0-project-alert-rule-details")
    def delete(self, request: Request, project, alert_rule) -> Response:
        """
        Delete a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return remove_alert_rule(request, project.organization, alert_rule)
