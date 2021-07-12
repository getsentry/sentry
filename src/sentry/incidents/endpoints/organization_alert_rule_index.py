from datetime import datetime

from django.db.models import DateTimeField, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils.timezone import make_aware
from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import (
    CombinedQuerysetIntermediary,
    CombinedQuerysetPaginator,
    OffsetPaginator,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import CombinedRuleSerializer
from sentry.api.utils import InvalidParams
from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.incidents.models import AlertRule, Incident
from sentry.models import OrganizationMemberTeam, Project, Rule, RuleStatus, Team
from sentry.snuba.dataset import Dataset
from sentry.utils.cursors import Cursor, StringCursor

from .utils import parse_team_params


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

        # Materialize the project ids here. This helps us to not overwhelm the query planner with
        # overcomplicated subqueries. Previously, this was causing Postgres to use a suboptimal
        # index to filter on.
        project_ids = list(project_ids)

        teams = request.GET.getlist("team", [])
        team_filter_query = None
        if len(teams) > 0:
            try:
                teams_query, unassigned = parse_team_params(request, organization, teams)
            except InvalidParams as err:
                return Response(str(err), status=status.HTTP_400_BAD_REQUEST)

            team_filter_query = Q(owner_id__in=teams_query.values_list("actor_id", flat=True))
            if unassigned:
                team_filter_query = team_filter_query | Q(owner_id=None)

        alert_rules = AlertRule.objects.fetch_for_organization(organization, project_ids)
        if not features.has("organizations:performance-view", organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)
        issue_rules = Rule.objects.filter(
            status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE], project__in=project_ids
        )
        name = request.GET.get("name", None)
        if name:
            alert_rules = alert_rules.filter(Q(name__icontains=name))
            issue_rules = issue_rules.filter(Q(label__icontains=name))

        if team_filter_query:
            alert_rules = alert_rules.filter(team_filter_query)
            issue_rules = issue_rules.filter(team_filter_query)

        expand = request.GET.getlist("expand", [])
        if "latestIncident" in expand:
            alert_rules = alert_rules.annotate(
                incident_id=Coalesce(
                    Subquery(
                        Incident.objects.filter(alert_rule=OuterRef("pk"))
                        .order_by("-date_started")
                        .values("id")[:1]
                    ),
                    Value("-1"),
                )
            )

        is_asc = request.GET.get("asc", False) == "1"
        sort_key = request.GET.getlist("sort", ["date_added"])
        rule_sort_key = [
            "label" if x == "name" else x for x in sort_key
        ]  # Rule's don't share the same field name for their title/label/name...so we account for that here.
        case_insensitive = sort_key == ["name"]

        if "incident_status" in sort_key:
            alert_rules = alert_rules.annotate(
                incident_status=Coalesce(
                    Subquery(
                        Incident.objects.filter(alert_rule=OuterRef("pk"))
                        .order_by("-date_started")
                        .values("status")[:1]
                    ),
                    Value(-1, output_field=IntegerField()),
                )
            )
            issue_rules = issue_rules.annotate(
                incident_status=Value(-2, output_field=IntegerField())
            )

        if "date_triggered" in sort_key:
            far_past_date = Value(make_aware(datetime.min), output_field=DateTimeField())
            alert_rules = alert_rules.annotate(
                date_triggered=Coalesce(
                    Subquery(
                        Incident.objects.filter(alert_rule=OuterRef("pk"))
                        .order_by("-date_started")
                        .values("date_started")[:1]
                    ),
                    far_past_date,
                ),
            )
            issue_rules = issue_rules.annotate(date_triggered=far_past_date)
        alert_rule_intermediary = CombinedQuerysetIntermediary(alert_rules, sort_key)
        rule_intermediary = CombinedQuerysetIntermediary(issue_rules, rule_sort_key)
        return self.paginate(
            request,
            paginator_cls=CombinedQuerysetPaginator,
            on_results=lambda x: serialize(x, request.user, CombinedRuleSerializer(expand=expand)),
            default_per_page=25,
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=not is_asc,
            cursor_cls=StringCursor if case_insensitive else Cursor,
            case_insensitive=case_insensitive,
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
