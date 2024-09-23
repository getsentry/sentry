from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.incidents.endpoints.organization_alert_rule_index import (
    AlertRuleIndexMixin,
    create_metric_alert,
)
from sentry.models.project import Project


@region_silo_endpoint
class ProjectAlertRuleIndexEndpoint(ProjectEndpoint, AlertRuleIndexMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectAlertRulePermission,)

    def get(self, request: Request, project: Project) -> Response:
        """
        Fetches metric alert rules for a project - @deprecated. Use OrganizationAlertRuleIndexEndpoint instead.
        """
        return self.fetch_metric_alert(request, project.organization, project)

    def post(self, request: Request, project: Project) -> Response:
        """
        Create an alert rule - @deprecated. Use OrganizationAlertRuleIndexEndpoint instead.
        """
        return create_metric_alert(
            project=project,
            organization=project.organization,
            user=request.user,
            data=request.data,
            access=request.access,
            query_params=request.query_params,
            is_api_token=request.auth is not None,
            ip_address=request.META.get("REMOTE_ADDR"),
            sender=ProjectAlertRuleIndexEndpoint,
        )
