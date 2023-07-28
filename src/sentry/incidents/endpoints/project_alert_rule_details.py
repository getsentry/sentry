from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.incidents.endpoints.bases import ProjectAlertRuleEndpoint
from sentry.incidents.endpoints.organization_alert_rule_details import (
    fetch_alert_rule,
    update_alert_rule,
)
from sentry.incidents.logic import AlreadyDeletedError, delete_alert_rule


@region_silo_endpoint
class ProjectAlertRuleDetailsEndpoint(ProjectAlertRuleEndpoint):
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
        try:
            delete_alert_rule(alert_rule, request.user, ip_address=request.META.get("REMOTE_ADDR"))
            return Response(status=status.HTTP_204_NO_CONTENT)
        except AlreadyDeletedError:
            return Response(
                "This rule has already been deleted", status=status.HTTP_400_BAD_REQUEST
            )
