from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.incidents.endpoints.organization_alert_rule_index import AlertRuleIndexMixin


@region_silo_endpoint
class ProjectAlertRuleIndexEndpoint(ProjectEndpoint, AlertRuleIndexMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectAlertRulePermission,)

    def get(self, request: Request, project) -> Response:
        """
        Fetches metric alert rules for a project - @deprecated. Use OrganizationAlertRuleIndexEndpoint instead.
        """
        return self.fetch_metric_alert(request, project.organization, project)

    def post(self, request: Request, project) -> Response:
        """
        Create an alert rule - @deprecated. Use OrganizationAlertRuleIndexEndpoint instead.
        """
        return self.create_metric_alert(request, project.organization, project)
