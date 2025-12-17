import functools
import logging
from collections.abc import Callable

from django.contrib.auth.models import AnonymousUser
from django.db import router, transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_serializer
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.fields.actor import ActorField
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.metric_alert_examples import MetricAlertExamples
from sentry.apidocs.parameters import GlobalParams, MetricAlertParams
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.endpoints.serializers.alert_rule import (
    AlertRuleSerializer,
    DetailedAlertRuleSerializer,
)
from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
    WorkflowEngineDetectorSerializer,
)
from sentry.incidents.logic import (
    AlreadyDeletedError,
    delete_alert_rule,
    get_slack_actions_with_async_lookups,
)
from sentry.incidents.metric_issue_detector import is_invalid_extrapolation_mode
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.serializers import AlertRuleSerializer as DrfAlertRuleSerializer
from sentry.incidents.utils.sentry_apps import trigger_sentry_app_action_creators_for_incidents
from sentry.integrations.slack.tasks.find_channel_id_for_alert_rule import (
    find_channel_id_for_alert_rule,
)
from sentry.integrations.slack.utils.rule_status import RedisRuleStatus
from sentry.models.organization import Organization
from sentry.models.rulesnooze import RuleSnooze
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.utils.errors import SentryAppBaseError
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import ExtrapolationMode
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import dual_delete_migrated_alert_rule
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.utils.legacy_metric_tracking import track_alert_endpoint_execution

logger = logging.getLogger(__name__)


def _anon_to_None[T](u: T | AnonymousUser) -> T | None:
    return None if isinstance(u, AnonymousUser) else u


def fetch_alert_rule(
    request: Request, organization: Organization, alert_rule: AlertRule
) -> Response:
    # Serialize Alert Rule
    expand = request.GET.getlist("expand", [])

    if features.has("organizations:workflow-engine-rule-serializers", organization):
        try:
            detector = Detector.objects.with_type_filters().get(
                alertruledetector__alert_rule_id=alert_rule.id
            )
            return Response(
                serialize(
                    detector,
                    request.user,
                    WorkflowEngineDetectorSerializer(expand=expand, prepare_component_fields=True),
                )
            )
        except Detector.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    serialized_rule = serialize(
        alert_rule,
        request.user,
        DetailedAlertRuleSerializer(expand=expand, prepare_component_fields=True),
    )

    rule_snooze = RuleSnooze.objects.filter(
        Q(user_id=request.user.id) | Q(user_id=None), alert_rule=alert_rule
    ).first()
    if rule_snooze:
        serialized_rule["snooze"] = True
        if request.user.id == rule_snooze.owner_id:
            serialized_rule["snoozeCreatedBy"] = "You"
        else:
            if rule_snooze.owner_id:
                user = user_service.get_user(rule_snooze.owner_id)
                if user:
                    serialized_rule["snoozeCreatedBy"] = user.get_display_name()
        serialized_rule["snoozeForEveryone"] = rule_snooze.user_id is None

    return Response(serialized_rule)


def update_alert_rule(
    request: Request, organization: Organization, alert_rule: AlertRule
) -> Response:
    data = request.data
    validator = DrfAlertRuleSerializer(
        context={
            "organization": organization,
            "access": request.access,
            "user": request.user,
            "ip_address": request.META.get("REMOTE_ADDR"),
            "installations": app_service.installations_for_organization(
                organization_id=organization.id
            ),
        },
        instance=alert_rule,
        data=data,
        partial=True,
    )
    if validator.is_valid():
        if (
            data.get("dataset", alert_rule.snuba_query.dataset)
            == Dataset.EventsAnalyticsPlatform.value
        ):
            if data.get("extrapolation_mode"):
                old_extrapolation_mode = ExtrapolationMode(
                    alert_rule.snuba_query.extrapolation_mode
                ).name.lower()
                new_extrapolation_mode = data.get("extrapolation_mode", old_extrapolation_mode)
                if is_invalid_extrapolation_mode(old_extrapolation_mode, new_extrapolation_mode):
                    raise serializers.ValidationError(
                        "Invalid extrapolation mode for this alert type."
                    )

        try:
            trigger_sentry_app_action_creators_for_incidents(validator.validated_data)
        except SentryAppBaseError as e:
            return e.response_from_exception()

        if get_slack_actions_with_async_lookups(organization, data):
            # need to kick off an async job for Slack
            client = RedisRuleStatus()
            task_args = {
                "organization_id": organization.id,
                "uuid": client.uuid,
                "data": data,
                "alert_rule_id": alert_rule.id,
                "user_id": request.user.id,
            }
            find_channel_id_for_alert_rule.apply_async(kwargs=task_args)
            # The user has requested a new Slack channel and we tell the client to check again in a bit
            return Response({"uuid": client.uuid}, status=202)
        else:
            if features.has("organizations:workflow-engine-rule-serializers", organization):
                validator.save()
                try:
                    detector = Detector.objects.with_type_filters().get(
                        alertruledetector__alert_rule_id=alert_rule.id
                    )
                    return Response(
                        serialize(
                            detector,
                            request.user,
                            WorkflowEngineDetectorSerializer(),
                        ),
                        status=status.HTTP_200_OK,
                    )
                except Detector.DoesNotExist:
                    return Response(status=status.HTTP_404_NOT_FOUND)
            return Response(serialize(validator.save(), request.user), status=status.HTTP_200_OK)

    return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)


def remove_alert_rule(
    request: Request, organization: Organization, alert_rule: AlertRule
) -> Response:
    try:
        # NOTE: we want to run the dual delete regardless of whether the user is flagged into dual writes:
        # the user could be removed from the dual write flag for whatever reason, and we need to make sure
        # that the extra table data is deleted. If the rows don't exist, we'll exit early.
        with transaction.atomic(router.db_for_write(AlertRule)):
            try:
                dual_delete_migrated_alert_rule(alert_rule=alert_rule)
            except Exception as e:
                logger.exception(
                    "Error when dual deleting alert rule",
                    extra={"details": str(e)},
                )
                return Response(
                    "Error when dual deleting alert rule",
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            delete_alert_rule(
                alert_rule,
                user=_anon_to_None(request.user),
                ip_address=request.META.get("REMOTE_ADDR"),
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
    except AlreadyDeletedError:
        return Response("This rule has already been deleted", status=status.HTTP_400_BAD_REQUEST)


@extend_schema_serializer(exclude_fields=["excludedProjects", "thresholdPeriod"])
class OrganizationAlertRuleDetailsPutSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256, help_text="The name for the rule.")
    aggregate = serializers.CharField(
        help_text="A string representing the aggregate function used in this alert rule. Valid aggregate functions are `count`, `count_unique`, `percentage`, `avg`, `apdex`, `failure_rate`, `p50`, `p75`, `p95`, `p99`, `p100`, and `percentile`. See **Metric Alert Rule Types** under [Create a Metric Alert Rule](/api/alerts/create-a-metric-alert-rule-for-an-organization/#metric-alert-rule-types) for valid configurations."
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
    projects = serializers.ListField(
        child=ProjectField(scope="project:read"),
        help_text="The names of the projects to filter by.",
    )
    query = serializers.CharField(
        help_text='An event search query to subscribe to and monitor for alerts. For example, to filter transactions so that only those with status code 400 are included, you could use `"query": "http.status_code:400"`. Use an empty string for no filter.',
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
- `actions`: A list of actions that take place when the threshold is met.
```json
triggers: [
    {
        "label": "critical",
        "alertThreshold": 100,
        "actions": [
            {
                "type": "email",
                "targetType": "user",
                "targetIdentifier": "23489853",
                "inputChannelId": None
                "integrationId": None,
                "sentryAppId": None
            }
        ]
    },
    {
        "label": "warning",
        "alertThreshold": 75,
        "actions": []
    }
]
```
Metric alert rule trigger actions follow the following structure:
- `type`: The type of trigger action. Valid values are `email`, `slack`, `msteams`, `pagerduty`, `sentry_app`, `sentry_notification`, and `opsgenie`.
- `targetType`: The type of target the notification will be sent to. Valid values are `specific`, `user`, `team`, and `sentry_app`.
- `targetIdentifier`: The ID of the target. This must be an integer for PagerDuty and Sentry apps, and a string for all others. Examples of appropriate values include a Slack channel name (`#my-channel`), a user ID, a team ID, a Sentry app ID, etc.
- `inputChannelId`: The ID of the Slack channel. This is only used for the Slack action, and can be used as an alternative to providing the `targetIdentifier`.
- `integrationId`: The integration ID. This is required for every action type except `email` and `sentry_app.`
- `sentryAppId`: The ID of the Sentry app. This is required when `type` is `sentry_app`.
- `priority`: The severity of the Pagerduty alert or the priority of the Opsgenie alert (optional). Defaults for Pagerduty are `critical` for critical and `warning` for warning. Defaults for Opsgenie are `P1` for critical and `P2` for warning.
""",
    )
    environment = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The name of the environment to filter by. Defaults to all environments.",
    )
    dataset = serializers.CharField(
        required=False,
        help_text="The name of the dataset that this query will be executed on. Valid values are `events`, `transactions`, `metrics`, `sessions`, and `generic-metrics`. Defaults to `events`. See **Metric Alert Rule Types** under [Create a Metric Alert Rule](/api/alerts/create-a-metric-alert-rule-for-an-organization/#metric-alert-rule-types) for valid configurations.",
    )
    queryType = serializers.ChoiceField(
        required=False,
        choices=((0, "event.type:error"), (1, "event.type:transaction"), (2, "None")),
        help_text="The type of query. If no value is provided, `queryType` is set to the default for the specified `dataset.` See **Metric Alert Rule Types** under [Create a Metric Alert Rule](/api/alerts/create-a-metric-alert-rule-for-an-organization/#metric-alert-rule-types) for valid configurations.",
    )
    eventTypes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="List of event types that this alert will be related to. Valid values are `default` (events captured using [Capture Message](/product/sentry-basics/integrate-backend/capturing-errors/#capture-message)), `error` and `transaction`.",
    )
    comparisonDelta = serializers.IntegerField(
        required=False,
        help_text='An optional int representing the time delta to use as the comparison period, in minutes. Required when using a percentage change threshold ("x%" higher or lower compared to `comparisonDelta` minutes ago). A percentage change threshold cannot be used for [Crash Free Session Rate](/api/alerts/create-a-metric-alert-rule-for-an-organization/#crash-free-session-rate) or [Crash Free User Rate](/api/alerts/create-a-metric-alert-rule-for-an-organization/#crash-free-user-rate).',
    )
    resolveThreshold = serializers.FloatField(
        required=False,
        help_text="Optional value that the metric needs to reach to resolve the alert. If no value is provided, this is set automatically based on the lowest severity trigger's `alertThreshold`. For example, if the alert is set to trigger at the warning level when the number of errors is above 50, then the alert would be set to resolve when there are less than 50 errors. If `thresholdType` is `0`, `resolveThreshold` must be greater than the critical threshold. Otherwise, it must be less than the critical threshold.",
    )
    owner = ActorField(
        required=False, allow_null=True, help_text="The ID of the team or user that owns the rule."
    )
    thresholdPeriod = serializers.IntegerField(required=False, default=1, min_value=1, max_value=20)


def _check_project_access[T](
    func: Callable[[T, Request, Organization, AlertRule], Response],
) -> Callable[[T, Request, Organization, AlertRule], Response]:
    @functools.wraps(func)
    def wrapper(
        self, request: Request, organization: Organization, alert_rule: AlertRule
    ) -> Response:
        project = None

        try:
            # check to see if there's a project associated with the alert rule
            project = alert_rule.projects.get()
        except Exception:
            pass

        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if not request.access.has_project_access(project):
            return Response(status=status.HTTP_403_FORBIDDEN)

        return func(self, request, organization, alert_rule)

    return wrapper


@extend_schema(tags=["Alerts"])
@region_silo_endpoint
class OrganizationAlertRuleDetailsEndpoint(OrganizationAlertRuleEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve a Metric Alert Rule for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            200: AlertRuleSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=MetricAlertExamples.GET_METRIC_ALERT_RULE,
    )
    @track_alert_endpoint_execution("GET", "sentry-api-0-organization-alert-rule-details")
    @_check_project_access
    def get(self, request: Request, organization: Organization, alert_rule: AlertRule) -> Response:
        """
        Return details on an individual metric alert rule.

        A metric alert rule is a configuration that defines the conditions for triggering an alert.
        It specifies the metric type, function, time interval, and threshold
        values that determine when an alert should be triggered. Metric alert rules are used to monitor
        and notify you when certain metrics, like error count, latency, or failure rate, cross a
        predefined threshold. These rules help you proactively identify and address issues in your
        project.
        """
        return fetch_alert_rule(request, organization, alert_rule)

    @extend_schema(
        operation_id="Update a Metric Alert Rule",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, MetricAlertParams.METRIC_RULE_ID],
        request=OrganizationAlertRuleDetailsPutSerializer,
        responses={
            200: AlertRuleSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=MetricAlertExamples.UPDATE_METRIC_ALERT_RULE,
    )
    @track_alert_endpoint_execution("PUT", "sentry-api-0-organization-alert-rule-details")
    @_check_project_access
    def put(self, request: Request, organization: Organization, alert_rule: AlertRule) -> Response:
        """
        Updates a metric alert rule. See **Metric Alert Rule Types** under
        [Create a Metric Alert Rule for an Organization](/api/alerts/create-a-metric-alert-rule-for-an-organization/#metric-alert-rule-types)
        to see valid request body configurations for different types of metric alert rule types.
        > Warning: Calling this endpoint fully overwrites the specified metric alert.

        A metric alert rule is a configuration that defines the conditions for triggering an alert.
        It specifies the metric type, function, time interval, and threshold
        values that determine when an alert should be triggered. Metric alert rules are used to monitor
        and notify you when certain metrics, like error count, latency, or failure rate, cross a
        predefined threshold. These rules help you proactively identify and address issues in your
        project.


        """
        return update_alert_rule(request, organization, alert_rule)

    @extend_schema(
        operation_id="Delete a Metric Alert Rule",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @track_alert_endpoint_execution("DELETE", "sentry-api-0-organization-alert-rule-details")
    @_check_project_access
    def delete(
        self, request: Request, organization: Organization, alert_rule: AlertRule
    ) -> Response:
        """
        Delete a specific metric alert rule.

        A metric alert rule is a configuration that defines the conditions for triggering an alert.
        It specifies the metric type, function, time interval, and threshold
        values that determine when an alert should be triggered. Metric alert rules are used to monitor
        and notify you when certain metrics, like error count, latency, or failure rate, cross a
        predefined threshold. These rules help you proactively identify and address issues in your
        project.
        """
        return remove_alert_rule(request, organization, alert_rule)
