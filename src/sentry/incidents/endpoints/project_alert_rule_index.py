from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import (
    CombinedQuerysetIntermediary,
    CombinedQuerysetPaginator,
    OffsetPaginator,
)
from sentry.api.serializers import CombinedRuleSerializer, serialize
from sentry.constants import ObjectStatus
from sentry.incidents.endpoints.organization_alert_rule_index import create_metric_alert
from sentry.incidents.models import AlertRule
from sentry.models import Rule
from sentry.snuba.dataset import Dataset


@region_silo_endpoint
class ProjectCombinedRuleIndexEndpoint(ProjectEndpoint):
    def get(self, request: Request, project) -> Response:
        """
        Fetches alert rules and legacy rules for a project
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
class ProjectAlertRuleIndexEndpoint(ProjectEndpoint):
    permission_classes = (ProjectAlertRulePermission,)

    def get(self, request: Request, project) -> Response:
        """
        Fetches metric alert rules for a project
        """
        if not features.has("organizations:incidents", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        alert_rules = AlertRule.objects.fetch_for_project(project)
        if not features.has("organizations:performance-view", project.organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)

        return self.paginate(
            request,
            queryset=alert_rules,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request: Request, project) -> Response:
        """
        Create an alert rule - @deprecated. Use OrganizationAlertRuleIndexEndpoint instead.
        """
        return create_metric_alert(self, request, project.organization)
