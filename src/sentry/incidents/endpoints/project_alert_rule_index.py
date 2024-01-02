from __future__ import annotations

from datetime import datetime

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.paginator import CombinedQuerysetIntermediary, CombinedQuerysetPaginator
from sentry.api.serializers import CombinedRuleSerializer, serialize
from sentry.constants import ObjectStatus
from sentry.incidents.endpoints.organization_alert_rule_index import AlertRuleIndexMixin
from sentry.incidents.models import AlertRule
from sentry.models.rule import Rule
from sentry.snuba.dataset import Dataset


@region_silo_endpoint
class ProjectCombinedRuleIndexEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    DEPRECATION_DATE = datetime.fromisoformat("2024-02-07T00:00:00+00:00:00")
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    @deprecated(DEPRECATION_DATE, "sentry-api-0-organization-combined-rules")
    def get(self, request: Request, project) -> Response:
        """
        Fetches alert rules and legacy rules for a project. @deprecated. Use OrganizationCombinedRuleIndexEndpoint instead.
        """
        alert_rules = AlertRule.objects.fetch_for_project(project)
        if not features.has("organizations:performance-view", project.organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)

        alert_rule_intermediary = CombinedQuerysetIntermediary(alert_rules, ["date_added"])
        rule_intermediary = CombinedQuerysetIntermediary(
            Rule.objects.filter(
                project=project,
                status=ObjectStatus.ACTIVE,
            ),
            ["date_added"],
        )

        return self.paginate(
            request,
            paginator_cls=CombinedQuerysetPaginator,
            on_results=lambda x: serialize(x, request.user, CombinedRuleSerializer()),
            default_per_page=25,
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=True,
        )


@region_silo_endpoint
class ProjectAlertRuleIndexEndpoint(ProjectEndpoint, AlertRuleIndexMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
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
