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


@region_silo_endpoint
class ProjectAlertRuleDetailsEndpoint(ProjectAlertRuleEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project, alert_rule) -> Response:
        """
        Fetch a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return fetch_alert_rule(request, project.organization, alert_rule)

    def put(self, request: Request, project, alert_rule) -> Response:
        """
        Update a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return update_alert_rule(request, project.organization, alert_rule)

    def delete(self, request: Request, project, alert_rule) -> Response:
        """
        Delete a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return remove_alert_rule(request, project.organization, alert_rule)
