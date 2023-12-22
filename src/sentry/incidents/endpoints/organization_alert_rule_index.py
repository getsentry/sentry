from copy import deepcopy
from datetime import datetime
from typing import List

from django.db.models import DateTimeField, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils.timezone import make_aware
from drf_spectacular.utils import extend_schema, extend_schema_serializer
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.organization import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.fields.actor import ActorField
from sentry.api.paginator import (
    CombinedQuerysetIntermediary,
    CombinedQuerysetPaginator,
    OffsetPaginator,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import (
    AlertRuleSerializer,
    AlertRuleSerializerResponse,
    CombinedRuleSerializer,
)
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.metric_alert_examples import MetricAlertExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidParams
from sentry.incidents.logic import get_slack_actions_with_async_lookups
from sentry.incidents.models import AlertRule, Incident
from sentry.incidents.serializers import AlertRuleSerializer as DrfAlertRuleSerializer
from sentry.incidents.utils.sentry_apps import trigger_sentry_app_action_creators_for_incidents
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleSource
from sentry.models.team import Team
from sentry.services.hybrid_cloud.app import app_service
from sentry.signals import alert_rule_created
from sentry.snuba.dataset import Dataset
from sentry.tasks.integrations.slack import find_channel_id_for_alert_rule
from sentry.utils.cursors import Cursor, StringCursor

from .utils import parse_team_params


class AlertRuleIndexMixin(Endpoint):
    def fetch_metric_alert(self, request, organization, project=None):
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        if not project:
            projects = self.get_projects(request, organization)
            alert_rules = AlertRule.objects.fetch_for_organization(organization, projects)
        else:
            alert_rules = AlertRule.objects.fetch_for_project(project)
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

    def create_metric_alert(self, request, organization, project=None):
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        data = deepcopy(request.data)
        if project:
            data["projects"] = [project.slug]

        serializer = DrfAlertRuleSerializer(
            context={
                "organization": organization,
                "access": request.access,
                "user": request.user,
                "ip_address": request.META.get("REMOTE_ADDR"),
                "installations": app_service.get_installed_for_organization(
                    organization_id=organization.id
                ),
            },
            data=data,
        )
        if serializer.is_valid():
            trigger_sentry_app_action_creators_for_incidents(serializer.validated_data)
            if get_slack_actions_with_async_lookups(organization, request.user, request.data):
                # need to kick off an async job for Slack
                client = RedisRuleStatus()
                task_args = {
                    "organization_id": organization.id,
                    "uuid": client.uuid,
                    "data": request.data,
                    "user_id": request.user.id,
                }
                find_channel_id_for_alert_rule.apply_async(kwargs=task_args)
                return Response({"uuid": client.uuid}, status=202)
            else:
                alert_rule = serializer.save()
                referrer = request.query_params.get("referrer")
                session_id = request.query_params.get("sessionId")
                duplicate_rule = request.query_params.get("duplicateRule")
                wizard_v3 = request.query_params.get("wizardV3")
                subscriptions = alert_rule.snuba_query.subscriptions.all()
                for sub in subscriptions:
                    alert_rule_created.send_robust(
                        user=request.user,
                        project=sub.project,
                        rule=alert_rule,
                        rule_type="metric",
                        sender=self,
                        referrer=referrer,
                        session_id=session_id,
                        is_api_token=request.auth is not None,
                        duplicate_rule=duplicate_rule,
                        wizard_v3=wizard_v3,
                    )
                return Response(serialize(alert_rule, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@region_silo_endpoint
class OrganizationCombinedRuleIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        """
        Fetches (metric) alert rules and legacy (issue alert) rules for an organization
        """
        project_ids = self.get_requested_project_ids_unchecked(request) or None
        if project_ids == {-1}:  # All projects for org:
            project_ids = Project.objects.filter(
                organization=organization, status=ObjectStatus.ACTIVE
            ).values_list("id", flat=True)
        elif project_ids is None:  # All projects for user
            org_team_list = Team.objects.filter(organization=organization).values_list(
                "id", flat=True
            )
            user_team_list = OrganizationMemberTeam.objects.filter(
                organizationmember__user_id=request.user.id, team__in=org_team_list
            ).values_list("team", flat=True)
            project_ids = Project.objects.filter(
                teams__in=user_team_list, status=ObjectStatus.ACTIVE
            ).values_list("id", flat=True)

        # Materialize the project ids here. This helps us to not overwhelm the query planner with
        # overcomplicated subqueries. Previously, this was causing Postgres to use a suboptimal
        # index to filter on. Also enforces permission checks.
        projects = self.get_projects(request, organization, project_ids=set(project_ids))

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

        alert_rules = AlertRule.objects.fetch_for_organization(organization, projects)
        issue_rules = Rule.objects.filter(
            status__in=[ObjectStatus.ACTIVE, ObjectStatus.DISABLED],
            source__in=[RuleSource.ISSUE],
            project__in=projects,
        )

        if not features.has("organizations:performance-view", organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)
        else:
            datasets = request.GET.getlist("dataset", [])
            if len(datasets) > 0:
                alert_rules = alert_rules.filter(snuba_query__dataset__in=datasets)
                if Dataset.Events.value not in datasets:
                    issue_rules = Rule.objects.none()

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
                    Value(-1),
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
        alert_rules_count = alert_rules.count()
        issue_rules_count = issue_rules.count()
        alert_rule_intermediary = CombinedQuerysetIntermediary(alert_rules, sort_key)
        rule_intermediary = CombinedQuerysetIntermediary(issue_rules, rule_sort_key)
        response = self.paginate(
            request,
            paginator_cls=CombinedQuerysetPaginator,
            on_results=lambda x: serialize(x, request.user, CombinedRuleSerializer(expand=expand)),
            default_per_page=25,
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=not is_asc,
            cursor_cls=StringCursor if case_insensitive else Cursor,
            case_insensitive=case_insensitive,
        )
        response["X-Sentry-Issue-Rule-Hits"] = issue_rules_count
        response["X-Sentry-Alert-Rule-Hits"] = alert_rules_count
        return response


@extend_schema_serializer(exclude_fields=["excludedProjects", "thresholdPeriod"])
class OrganizationAlertRuleIndexPostSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=64,
        help_text="The name for the rule, which has a maximimum length of 64 characters.",
    )
    aggregate = serializers.CharField(
        help_text="A string representing the aggregate function used in this alert rule. Valid aggregate functions are `count`, `count_unique`, `percentage`, `avg`, `apdex`, `failure_rate`, `p50`, `p75`, `p95`, `p99`, `p100`, and `percentile`. See [Metric Alert Rule Types](#metric-alert-rule-types) for valid configurations."
    )
    timeWindow = serializers.ChoiceField(
        choices=(
            (1, "1 minute"),
            (5, "5 minutes"),
            (10, "10 minutes"),
            (15, "15 minutes"),
            (30, "30 minutes"),
            (60, "1 hour"),
            (120, "2 hours"),
            (240, "4 hours"),
            (1440, "24 hours"),
        ),
        help_text="The time period to aggregate over.",
    )
    # projects is not required in the serializer, however, the UI requires a project is chosen
    projects = serializers.ListField(
        child=ProjectField(scope="project:read"),
        help_text="Metric alerts are currently limited to one project. The array should contain a single slug, representing the project to filter by.",
    )
    query = serializers.CharField(
        help_text='An event search query to subscribe to and monitor for alerts. For example, to filter transactions so that only those with status code 400 are included, you could use `"query": "http.status_code:400"`. Use an empty string for no filter.'
    )
    thresholdType = serializers.ChoiceField(
        choices=((0, "Above"), (1, "Below")),
        help_text='The comparison operator for the critical and warning thresholds. The comparison operator for the resolved threshold is automatically set to the opposite operator. When a percentage change threshold is used, `0` is equivalent to "Higher than" and `1` is equivalent to "Lower than".',
    )
    triggers = serializers.ListField(
        help_text="""
A list of triggers, where each trigger is an object with the following fields:
- `label`: One of `critical` or `warning`. A `critical` trigger is always required.
- `alertThreshold`: The value that the subscription needs to reach to trigger the
alert rule.
- `actions`: A list of actions that take place when the threshold is met. Set as an empty list if no actions are to take place.
```json
triggers: [
    {
        "label": "critical",
        "alertThreshold": 50,
        "actions": [
            {
                "type": "slack",
                "targetType": "specific",
                "targetIdentifier": "#get-crit",
                "inputChannelId": 2454362
                "integrationId": 653532,
            }
        ]
    },
    {
        "label": "warning",
        "alertThreshold": 25,
        "actions": []
    }
]
```
Metric alert rule trigger actions follow the following structure:
- `type`: The type of trigger action. Valid values are `email`, `slack`, `msteams`, `pagerduty`, `sentry_app`, `sentry_notification`, and `opsgenie`.
- `targetType`: The type of target the notification will be sent to. Valid values are `specific` (`targetIdentifier` is a direct reference used by the service, like an email address or a Slack channel ID), `user` (`targetIdentifier` is a Sentry user ID), `team` (`targetIdentifier` is a Sentry team ID), and `sentry_app` (`targetIdentifier` is a SentryApp ID).
- `targetIdentifier`: The ID of the target. This must be an integer for PagerDuty and Sentry apps, and a string for all others. Examples of appropriate values include a Slack channel name (`#my-channel`), a user ID, a team ID, a Sentry app ID, etc.
- `inputChannelId`: The ID of the Slack channel. This is only used for the Slack action, and can be used as an alternative to providing the `targetIdentifier`.
- `integrationId`: The integration ID. This is required for every action type excluding `email` and `sentry_app.`
- `sentryAppId`: The ID of the Sentry app. This is required when `type` is `sentry_app`.
"""
    )
    environment = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The name of the environment to filter by. Defaults to all environments.",
    )
    dataset = serializers.CharField(
        required=False,
        help_text="The name of the dataset that this query will be executed on. Valid values are `events`, `transactions`, `metrics`, `sessions`, and `generic-metrics`. Defaults to `events`. See [Metric Alert Rule Types](#metric-alert-rule-types) for valid configurations.",
    )
    queryType = serializers.ChoiceField(
        required=False,
        choices=((0, "event.type:error"), (1, "event.type:transaction"), (2, "None")),
        help_text="The type of query. If no value is provided, `queryType` is set to the default for the specified `dataset.` See [Metric Alert Rule Types](#metric-alert-rule-types) for valid configurations.",
    )
    eventTypes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="List of event types that this alert will be related to. Valid values are `default` (events captured using [Capture Message](/product/sentry-basics/integrate-backend/capturing-errors/#capture-message)), `error` and `transaction`.",
    )
    comparisonDelta = serializers.IntegerField(
        required=False,
        help_text='An optional int representing the time delta to use as the comparison period, in minutes. Required when using a percentage change threshold ("x%" higher or lower compared to `comparisonDelta` minutes ago). A percentage change threshold cannot be used for [Crash Free Session Rate](#crash-free-session-rate) or [Crash Free User Rate](#crash-free-user-rate).',
    )
    resolveThreshold = serializers.FloatField(
        required=False,
        help_text="Optional value that the metric needs to reach to resolve the alert. If no value is provided, this is set automatically based on the lowest severity trigger's `alertThreshold`. For example, if the alert is set to trigger at the warning level when the number of errors is above 50, then the alert would be set to resolve when there are less than 50 errors. If `thresholdType` is `0`, `resolveThreshold` must be greater than the critical threshold, otherwise, it must be less than the critical threshold.",
    )
    owner = ActorField(
        required=False, allow_null=True, help_text="The ID of the team or user that owns the rule."
    )
    excludedProjects = serializers.ListField(
        child=ProjectField(scope="project:read"), required=False
    )
    thresholdPeriod = serializers.IntegerField(required=False, default=1, min_value=1, max_value=20)


@extend_schema(tags=["Alerts"])
@region_silo_endpoint
class OrganizationAlertRuleIndexEndpoint(OrganizationEndpoint, AlertRuleIndexMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationAlertRulePermission,)

    @extend_schema(
        operation_id="List an Organization's Metric Alert Rules",
        parameters=[GlobalParams.ORG_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListMetricAlertRules", List[AlertRuleSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=MetricAlertExamples.LIST_METRIC_ALERT_RULES,  # TODO: make
    )
    def get(self, request: Request, organization) -> Response:
        """
        Return a list of active metric alert rules bound to an organization.

        A metric alert rule is a configuration that defines the conditions for triggering an alert.
        It specifies the metric type, function, time interval, and threshold
        values that determine when an alert should be triggered. Metric alert rules are used to monitor
        and notify you when certain metrics, like error count, latency, or failure rate, cross a
        predefined threshold. These rules help you proactively identify and address issues in your
        project.
        """
        return self.fetch_metric_alert(request, organization)

    @extend_schema(
        operation_id="Create a Metric Alert Rule for an Organization",
        parameters=[GlobalParams.ORG_SLUG],
        request=OrganizationAlertRuleIndexPostSerializer,
        responses={
            201: AlertRuleSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=MetricAlertExamples.CREATE_METRIC_ALERT_RULE,
    )
    def post(self, request: Request, organization) -> Response:
        """
        Create a new metric alert rule for the given organization.

        A metric alert rule is a configuration that defines the conditions for triggering an alert.
        It specifies the metric type, function, time interval, and threshold
        values that determine when an alert should be triggered. Metric alert rules are used to monitor
        and notify you when certain metrics, like error count, latency, or failure rate, cross a
        predefined threshold. These rules help you proactively identify and address issues in your
        project.

        ## Metric Alert Rule Types
        Below are the types of metric alert rules you can create and the parameter values required
        to set them up. All other parameters can be customized based on how you want the alert
        rule to work. Scroll down to Body Parameters for more information. Visit the
        [Alert Types](/product/alerts/alert-types/#metric-alerts) docs for more details on each
        metric alert rule type.

        ### [Number of Errors](/product/alerts/alert-types/#number-of-errors)
        - `eventTypes`: Any of `error` or `default`.
        ```json
        {
            "queryType": 0,
            "dataset": "events",
            "aggregate": "count()",
            "eventTypes": ["error", "default"]
        }
        ```

        ### [Users Experiencing Errors](/product/alerts/alert-types/#users-experiencing-errors)
        - `eventTypes`: Any of `error` or `default`.
        ```json
        {
            "queryType": 0,
            "dataset": "events",
            "aggregate": "count_unique(user)"
        }
        ```

        ### [Crash Free Session Rate](/product/alerts/alert-types/#crash-free-session-rate)
        ```json
        {
            "queryType": 2,
            "dataset": "metrics",
            "aggregate": "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
        }
        ```

        ### [Crash Free User Rate](/product/alerts/alert-types/#crash-free-user-rate)
        ```json
        {
            "queryType": 2,
            "dataset": "metrics",
            "aggregate": "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"
        }
        ```

        ### [Throughput](/product/alerts/alert-types/#throughput)
        ```json
        {
            "queryType": 1,
            "dataset": "transactions",
            "aggregate": "count()"
        }
        ```

        ### [Transaction Duration](/product/alerts/alert-types/#transaction-duration)
        -  `dataset`: If a custom percentile is used, `dataset` is `transactions`. Otherwise, `dataset` is `generic_metrics`.
        -  `aggregate`: Valid values are `avg(transaction.duration)`, `p50(transaction.duration)`, `p75(transaction.duration)`, `p95(transaction.duration)`, `p99(transaction.duration)`, `p100(transaction.duration)`, and `percentile(transaction.duration,x)`, where `x` is your custom percentile.
        ```json
        {
            "queryType": 1,
            "dataset": "generic_metrics",
            "aggregate": "avg(transaction.duration)"
        }
        ```

        ### [Apdex](/product/alerts/alert-types/#apdex)
        - `aggregate`: `apdex(x)` where `x` is the value of the Apdex score.
        ```json
        {
            "queryType": 1,
            "dataset": "transactions",
            "aggregate": "apdex(300)"
        }
        ```

        ### [Failure Rate](/product/alerts/alert-types/#failure-rate)
        ```json
        {
            "queryType": 1,
            "dataset": "transactions",
            "aggregate": "failure_rate()"
        }
        ```

        ### [Largest Contentful Paint](/product/alerts/alert-types/#largest-contentful-display)
        - `dataset`: If a custom percentile is used, `dataset` is `transactions`. Otherwise, `dataset` is `generic_metrics`.
        - `aggregate`: Valid values are `avg(measurements.lcp)`, `p50(measurements.lcp)`, `p75(measurements.lcp)`, `p95(measurements.lcp)`, `p99(measurements.lcp)`, `p100(measurements.lcp)`, and `percentile(measurements.lcp,x)`, where `x` is your custom percentile.
        ```json
        {
            "queryType": 1,
            "dataset": "generic_metrics",
            "aggregate": "p50(measurements.lcp)"
        }
        ```

        ### [First Input Delay](/product/alerts/alert-types/#first-input-delay)
        - `dataset`: If a custom percentile is used, `dataset` is `transactions`. Otherwise, `dataset` is `generic_metrics`.
        - `aggregate`: Valid values are `avg(measurements.fid)`, `p50(measurements.fid)`, `p75(measurements.fid)`, `p95(measurements.fid)`, `p99(measurements.fid)`, `p100(measurements.fid)`, and `percentile(measurements.fid,x)`, where `x` is your custom percentile.
        ```json
        {
            "queryType": 1,
            "dataset": "generic_metrics",
            "aggregate": "p100(measurements.fid)"
        }
        ```

        ### [Cumulative Layout Shift](/product/alerts/alert-types/#cumulative-layout-shift)
        - `dataset`: If a custom percentile is used, `dataset` is `transactions`. Otherwise, `dataset` is `generic_metrics`.
        - `aggregate`: Valid values are `avg(measurements.cls)`, `p50(measurements.cls)`, `p75(measurements.cls)`, `p95(measurements.cls)`, `p99(measurements.cls)`, `p100(measurements.cls)`, and `percentile(measurements.cls,x)`, where `x` is your custom percentile.
        ```json
        {
            "queryType": 1,
            "dataset": "transactions",
            "aggregate": "percentile(measurements.cls,0.2)"
        }
        ```

        ### [Custom Metric](/product/alerts/alert-types/#custom-metric)
        - `dataset`: If a custom percentile is used, `dataset` is `transactions`. Otherwise, `dataset` is `generic_metrics`.
        - `aggregate`: Valid values are:
            - `avg(x)`, where `x` is `transaction.duration`, `measurements.cls`, `measurements.fcp`, `measurements.fid`, `measurements.fp`, `measurements.lcp`, `measurements.ttfb`, or `measurements.ttfb.requesttime`.
            - `p50(x)`, where `x` is `transaction.duration`, `measurements.cls`, `measurements.fcp`, `measurements.fid`, `measurements.fp`, `measurements.lcp`, `measurements.ttfb`, or `measurements.ttfb.requesttime`.
            - `p75(x)`, where `x` is `transaction.duration`, `measurements.cls`, `measurements.fcp`, `measurements.fid`, `measurements.fp`, `measurements.lcp`, `measurements.ttfb`, or `measurements.ttfb.requesttime`.
            - `p95(x)`, where `x` is `transaction.duration`, `measurements.cls`, `measurements.fcp`, `measurements.fid`, `measurements.fp`, `measurements.lcp`, `measurements.ttfb`, or `measurements.ttfb.requesttime`.
            - `p99(x)`, where `x` is `transaction.duration`, `measurements.cls`, `measurements.fcp`, `measurements.fid`, `measurements.fp`, `measurements.lcp`, `measurements.ttfb`, or `measurements.ttfb.requesttime`.
            - `p100(x)`, where `x` is `transaction.duration`, `measurements.cls`, `measurements.fcp`, `measurements.fid`, `measurements.fp`, `measurements.lcp`, `measurements.ttfb`, or `measurements.ttfb.requesttime`.
            - `percentile(x,y)`, where `x` is `transaction.duration`, `measurements.cls`, `measurements.fcp`, `measurements.fid`, `measurements.fp`, `measurements.lcp`, `measurements.ttfb`, or `measurements.ttfb.requesttime`, and `y` is the custom percentile.
            - `failure_rate()`
            - `apdex(x)`, where `x` is the value of the Apdex score.
            - `count()`
        ```json
        {
            "queryType": 1,
            "dataset": "generic_metrics",
            "aggregate": "p75(measurements.ttfb)"
        }
        ```
        """
        return self.create_metric_alert(request, organization)
