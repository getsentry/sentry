from collections.abc import Sequence

from dateutil.parser import parse as parse_date
from django.db.models import BigIntegerField, Q
from django.db.models.functions import Cast
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.incident import IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.exceptions import InvalidParams
from sentry.incidents.endpoints.serializers.incident import IncidentSerializer
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineIncidentSerializer,
)
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleActivity, AlertRuleActivityType
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription
from sentry.types.group import PriorityLevel
from sentry.utils.dates import ensure_aware
from sentry.workflow_engine.endpoints.utils.ids import to_valid_int_id
from sentry.workflow_engine.utils.legacy_metric_tracking import (
    report_used_legacy_models,
    track_alert_endpoint_execution,
)
from sentry.workflow_engine.models import AlertRuleDetector, DataSourceDetector

from .utils import parse_team_params


@cell_silo_endpoint
class OrganizationIncidentIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (IncidentPermission,)

    @track_alert_endpoint_execution("GET", "sentry-api-0-organization-incident-index")
    def get(self, request: Request, organization: Organization) -> Response:
        """
        List Incidents that a User can access within an Organization
        ````````````````````````````````````````````````````````````
        Returns a paginated list of Incidents that a user can access.

        :auth: required
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        # Parse query parameters (shared between both implementations)
        projects = self.get_projects(request, organization)
        envs = self.get_environments(request, organization)
        expand = request.GET.getlist("expand", [])
        title = request.GET.get("title")
        query_alert_rule = request.GET.get("alertRule")
        query_include_snapshots = request.GET.get("includeSnapshots")
        query_start_s = request.GET.get("start")
        query_end_s = request.GET.get("end")
        query_status = request.GET.get("status")
        teams = request.GET.getlist("team", [])

        use_workflow_engine = features.has(
            "organizations:workflow-engine-rule-serializers", organization
        )

        if use_workflow_engine:
            return self._get_workflow_engine(
                request,
                organization,
                projects=projects,
                envs=envs,
                expand=expand,
                title=title,
                query_alert_rule=query_alert_rule,
                query_include_snapshots=query_include_snapshots,
                query_start_s=query_start_s,
                query_end_s=query_end_s,
                query_status=query_status,
                teams=teams,
            )

        incidents = Incident.objects.fetch_for_organization(organization, projects)
        report_used_legacy_models()

        if envs:
            incidents = incidents.filter(alert_rule__snuba_query__environment__in=envs)
        if query_alert_rule is not None:
            query_alert_rule_id = to_valid_int_id("alertRule", query_alert_rule)
            alert_rule_ids = [query_alert_rule_id]
            if query_include_snapshots:
                snapshot_alerts = AlertRuleActivity.objects.filter(
                    previous_alert_rule=query_alert_rule_id,
                    type=AlertRuleActivityType.SNAPSHOT.value,
                )
                for snapshot_alert in snapshot_alerts:
                    alert_rule_ids.append(snapshot_alert.alert_rule_id)
            incidents = incidents.filter(alert_rule__in=alert_rule_ids)

        if query_start_s is not None:
            # exclude incidents closed before the window
            query_start = ensure_aware(parse_date(query_start_s))
            incidents = incidents.exclude(date_closed__lt=query_start)

        if query_end_s is not None:
            # exclude incidents started after the window
            query_end = ensure_aware(parse_date(query_end_s))
            incidents = incidents.exclude(date_started__gt=query_end)

        if query_status is not None:
            if query_status == "open":
                incidents = incidents.exclude(status=IncidentStatus.CLOSED.value)
            elif query_status == "warning":
                incidents = incidents.filter(status=IncidentStatus.WARNING.value)
            elif query_status == "critical":
                incidents = incidents.filter(status=IncidentStatus.CRITICAL.value)
            elif query_status == "closed":
                incidents = incidents.filter(status=IncidentStatus.CLOSED.value)

        if len(teams) > 0:
            try:
                teams_query, unassigned = parse_team_params(request, organization, teams)
            except InvalidParams as err:
                return Response(str(err), status=status.HTTP_400_BAD_REQUEST)

            team_filter_query = Q(alert_rule__team_id__in=teams_query.values_list("id", flat=True))
            if unassigned:
                team_filter_query = team_filter_query | Q(alert_rule__team_id__isnull=True)

            incidents = incidents.filter(team_filter_query)

        if title:
            incidents = incidents.filter(Q(title__icontains=title))

        if not features.has("organizations:performance-view", organization):
            # Filter to only error alerts
            incidents = incidents.filter(alert_rule__snuba_query__dataset=Dataset.Events.value)

        return self.paginate(
            request,
            queryset=incidents,
            order_by="-date_started",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, IncidentSerializer(expand=expand)),
            default_per_page=25,
        )

    def _get_workflow_engine(
        self,
        request: Request,
        organization: Organization,
        projects: Sequence,
        envs: Sequence,
        expand: list[str],
        title: str | None,
        query_alert_rule: str | None,
        query_include_snapshots: str | None,
        query_start_s: str | None,
        query_end_s: str | None,
        query_status: str | None,
        teams: list[str],
    ) -> Response:
        """
        Workflow Engine-based implementation that queries GroupOpenPeriod instead of Incident.
        """
        # Base query: GroupOpenPeriod for MetricIssue groups in the organization's projects
        open_periods = GroupOpenPeriod.objects.filter(
            project__organization=organization,
            project__in=projects,
            group__type=MetricIssue.type_id,
        ).select_related("group", "project__organization")

        # Environment filter
        if envs:
            open_periods = self._filter_by_environment(open_periods, envs)

        # Alert rule filter
        if query_alert_rule is not None:
            query_alert_rule_id = to_valid_int_id("alertRule", query_alert_rule)
            alert_rule_ids = [query_alert_rule_id]

            # Handle snapshot alerts (legacy)
            if query_include_snapshots:
                snapshot_alerts = AlertRuleActivity.objects.filter(
                    previous_alert_rule=query_alert_rule_id,
                    type=AlertRuleActivityType.SNAPSHOT.value,
                )
                for snapshot_alert in snapshot_alerts:
                    alert_rule_ids.append(snapshot_alert.alert_rule_id)

            # Translate alert rule IDs to detector IDs
            detector_ids = AlertRuleDetector.objects.filter(
                alert_rule_id__in=alert_rule_ids
            ).values_list("detector_id", flat=True)

            open_periods = open_periods.filter(group__detectorgroup__detector_id__in=detector_ids)

        # Date range filters
        if query_start_s is not None:
            # Exclude incidents closed before the window
            query_start = ensure_aware(parse_date(query_start_s))
            open_periods = open_periods.exclude(date_ended__lt=query_start)

        if query_end_s is not None:
            # Exclude incidents started after the window
            query_end = ensure_aware(parse_date(query_end_s))
            open_periods = open_periods.exclude(date_started__gt=query_end)

        # Status filter
        if query_status is not None:
            open_periods = self._filter_by_status(open_periods, query_status)

        # Team filter
        if len(teams) > 0:
            try:
                teams_query, unassigned = parse_team_params(request, organization, teams)
            except InvalidParams as err:
                return Response(str(err), status=status.HTTP_400_BAD_REQUEST)

            team_filter_query = Q(
                group__detectorgroup__detector__owner_team_id__in=teams_query.values_list(
                    "id", flat=True
                )
            )
            if unassigned:
                team_filter_query = team_filter_query | Q(
                    group__detectorgroup__detector__owner_team_id__isnull=True
                )

            open_periods = open_periods.filter(team_filter_query)

        # Title filter
        if title:
            open_periods = open_periods.filter(
                group__detectorgroup__detector__name__icontains=title
            )

        # Dataset filter (exclude performance alerts if performance-view not enabled)
        if not features.has("organizations:performance-view", organization):
            open_periods = self._filter_by_dataset(open_periods, Dataset.Events)

        # Apply distinct to handle joins through DetectorGroup
        open_periods = open_periods.distinct()

        return self.paginate(
            request,
            queryset=open_periods,
            order_by="-date_started",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, WorkflowEngineIncidentSerializer(expand=expand)
            ),
            default_per_page=25,
        )

    def _filter_by_environment(
        self, open_periods: BaseQuerySet[GroupOpenPeriod], envs: Sequence
    ) -> BaseQuerySet[GroupOpenPeriod]:
        """
        Filter open periods by environment via Detector → DataSource → QuerySubscription → SnubaQuery.
        """
        matching_detector_ids = (
            DataSourceDetector.objects.annotate(
                source_id_as_int=Cast("data_source__source_id", output_field=BigIntegerField())
            )
            .filter(
                data_source__type="snuba_query_subscription",
                source_id_as_int__in=QuerySubscription.objects.filter(
                    snuba_query__environment__in=envs
                ).values("id"),
            )
            .values("detector_id")
        )
        return open_periods.filter(group__detectorgroup__detector_id__in=matching_detector_ids)

    def _filter_by_status(
        self, open_periods: BaseQuerySet[GroupOpenPeriod], query_status: str
    ) -> BaseQuerySet[GroupOpenPeriod]:
        """Filter open periods by status (open, closed, warning, critical)."""
        if query_status == "open":
            # Open includes both warning and critical (anything not closed)
            return open_periods.filter(date_ended__isnull=True)
        elif query_status == "warning":
            return open_periods.filter(
                date_ended__isnull=True, group__priority=PriorityLevel.MEDIUM.value
            )
        elif query_status == "critical":
            return open_periods.filter(
                date_ended__isnull=True, group__priority=PriorityLevel.HIGH.value
            )
        elif query_status == "closed":
            return open_periods.filter(date_ended__isnull=False)
        return open_periods

    def _filter_by_dataset(
        self, open_periods: BaseQuerySet[GroupOpenPeriod], dataset: Dataset
    ) -> BaseQuerySet[GroupOpenPeriod]:
        """
        Filter open periods by dataset via Detector → DataSource → QuerySubscription → SnubaQuery.
        Uses the same Cast pattern as environment filter.
        """
        matching_detector_ids = (
            DataSourceDetector.objects.annotate(
                source_id_as_int=Cast("data_source__source_id", output_field=BigIntegerField())
            )
            .filter(
                data_source__type="snuba_query_subscription",
                source_id_as_int__in=QuerySubscription.objects.filter(
                    snuba_query__dataset=dataset.value
                ).values("id"),
            )
            .values("detector_id")
        )
        return open_periods.filter(group__detectorgroup__detector_id__in=matching_detector_ids)
