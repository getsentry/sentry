from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator, CombinedQuerysetPaginator
from sentry.api.serializers import serialize, CombinedRuleSerializer
from sentry.incidents.models import AlertRule
from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.snuba.dataset import Dataset
from sentry.models import Rule, RuleStatus, Project


class OrganizationCombinedRuleIndexEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Fetches alert rules and legacy rules for an organization
        """
        project_ids = self.get_requested_project_ids(request) or None

        alert_rules = AlertRule.objects.fetch_for_organization(organization, project_ids)
        if not features.has("organizations:performance-view", organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)

        if project_ids is None:
            project_ids = Project.objects.filter(organization=organization).values_list(
                "id", flat=True
            )

        issue_rules = Rule.objects.filter(
            status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE], project__in=project_ids
        )
        return self.paginate(
            request,
            paginator_cls=CombinedQuerysetPaginator,
            on_results=lambda x: serialize(x, request.user, CombinedRuleSerializer()),
            default_per_page=25,
            order_by="-date_added",
            querysets=[alert_rules, issue_rules],
        )


class OrganizationAlertRuleIndexEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Fetches alert rules for an organization
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        project_ids = self.get_requested_project_ids(request) or None
        alert_rules = AlertRule.objects.fetch_for_organization(organization, project_ids)
        if not features.has("organizations:performance-view", organization):
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

    def post(self, request, organization):
        """
        Create an alert rule
        """

        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        serializer = AlertRuleSerializer(
            context={"organization": organization, "access": request.access}, data=request.data
        )

        if serializer.is_valid():
            alert_rule = serializer.save()
            return Response(serialize(alert_rule, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
