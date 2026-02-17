from __future__ import annotations

from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.incidents.endpoints.organization_alert_rule_index import (
    AlertRuleFetchMixin,
    create_metric_alert,
)
from sentry.incidents.models.alert_rule import AlertRule
from sentry.workflow_engine.utils.legacy_metric_tracking import track_alert_endpoint_execution


@region_silo_endpoint
class ProjectAlertRuleIndexEndpoint(ProjectEndpoint, AlertRuleFetchMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectAlertRulePermission,)

    @track_alert_endpoint_execution("GET", "sentry-api-0-project-alert-rules")
    def get(self, request: Request, project) -> HttpResponseBase:
        """
        Fetches metric alert rules for a project - @deprecated. Use OrganizationAlertRuleIndexEndpoint instead.
        """
        alert_rules = AlertRule.objects.fetch_for_project(project)
        return self.fetch_metric_alert(request, project.organization, alert_rules)

    @track_alert_endpoint_execution("POST", "sentry-api-0-project-alert-rules")
    def post(self, request: Request, project) -> HttpResponseBase:
        """
        Create an alert rule - @deprecated. Use OrganizationAlertRuleIndexEndpoint instead.
        """
        return create_metric_alert(request, project.organization, project)
