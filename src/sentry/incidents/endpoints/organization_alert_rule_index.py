from rest_framework import status
from rest_framework.response import Response

from django.db.models import Q

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationAlertRulePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import (
    OffsetPaginator,
    CombinedQuerysetPaginator,
    CombinedQuerysetIntermediary,
)
from sentry.api.serializers import serialize, CombinedRuleSerializer
from sentry.incidents.models import AlertRule
from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.snuba.dataset import Dataset
from sentry.models import Rule, RuleStatus, Project, OrganizationMemberTeam, Team


class OrganizationCombinedRuleIndexEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Fetches alert rules and legacy rules for an organization
        """
        project_ids = self.get_requested_project_ids(request) or None
        if project_ids == {-1}:  # All projects for org:
            project_ids = Project.objects.filter(organization=organization).values_list(
                "id", flat=True
            )
        elif project_ids is None:  # All projects for user
            org_team_list = Team.objects.filter(organization=organization).values_list(
                "id", flat=True
            )
            user_team_list = OrganizationMemberTeam.objects.filter(
                organizationmember__user=request.user, team__in=org_team_list
            ).values_list("team", flat=True)
            project_ids = Project.objects.filter(teams__in=user_team_list).values_list(
                "id", flat=True
            )

        alert_rules = AlertRule.objects.fetch_for_organization(organization, project_ids)
        if not features.has("organizations:performance-view", organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)

        issue_rules = Rule.objects.filter(
            status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE], project__in=project_ids
        )

        name = request.GET.get("name", None)
        teams = request.GET.get("teams", [])
        if teams:
            alert_rules = alert_rules.filter(
                Q(owner_id__in=Team.objects.filter(id__in=teams).values_list("actor_id", flat=True))
            )
            issue_rules = issue_rules.filter(
                Q(owner_id__in=Team.objects.filter(id__in=teams).values_list("actor_id", flat=True))
            )

        if name:
            alert_rules = alert_rules.filter(name__contains=name)
            issue_rules = issue_rules.filter(label__contains=name)

        is_asc = request.GET.get("asc", False) == "1"
        sort_key = request.GET.get("sort", "date_added")
        rule_sort_key = (
            sort_key if sort_key != "name" else "label"
        )  # Rule's don't share the same field name for their title/label/name...so we account for that here.
        alert_rule_intermediary = CombinedQuerysetIntermediary(alert_rules, sort_key)
        rule_intermediary = CombinedQuerysetIntermediary(issue_rules, rule_sort_key)
        return self.paginate(
            request,
            paginator_cls=CombinedQuerysetPaginator,
            on_results=lambda x: serialize(x, request.user, CombinedRuleSerializer()),
            default_per_page=25,
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=not is_asc,
        )


class OrganizationAlertRuleIndexEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAlertRulePermission,)

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
