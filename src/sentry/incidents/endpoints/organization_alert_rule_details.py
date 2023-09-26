from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.fields.actor import ActorField
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)

# from sentry.apidocs.examples.metric_alert_examples import MetricAlertExamples # TODO: blocked
from sentry.apidocs.parameters import GlobalParams, MetricAlertParams
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.logic import (
    AlreadyDeletedError,
    delete_alert_rule,
    get_slack_actions_with_async_lookups,
)
from sentry.incidents.serializers import AlertRuleSerializer as DrfAlertRuleSerializer
from sentry.incidents.utils.sentry_apps import trigger_sentry_app_action_creators_for_incidents
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.models import Project, SentryAppComponent, SentryAppInstallation
from sentry.models.rulesnooze import RuleSnooze
from sentry.services.hybrid_cloud.app import app_service
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.tasks.integrations.slack import find_channel_id_for_alert_rule


def fetch_alert_rule(request: Request, organization, alert_rule):
    # Serialize Alert Rule
    expand = request.GET.getlist("expand", [])
    serialized_rule = serialize(
        alert_rule, request.user, DetailedAlertRuleSerializer(expand=expand)
    )

    # Prepare AlertRuleTriggerActions that are SentryApp components
    errors = []
    for trigger in serialized_rule.get("triggers", []):
        for action in trigger.get("actions", []):
            if action.get("_sentry_app_installation") and action.get("_sentry_app_component"):
                installation = SentryAppInstallation(**action.get("_sentry_app_installation", {}))
                component = installation.prepare_ui_component(
                    SentryAppComponent(**action.get("_sentry_app_component")),
                    None,
                    action.get("settings"),
                )
                if component is None:
                    errors.append(
                        {"detail": f"Could not fetch details from {installation.sentry_app.name}"}
                    )
                    action["disabled"] = True
                    continue

                action["formFields"] = component.schema.get("settings", {})

                # Delete meta fields
                del action["_sentry_app_installation"]
                del action["_sentry_app_component"]

    if len(errors):
        serialized_rule["errors"] = errors

    rule_snooze = RuleSnooze.objects.filter(
        Q(user_id=request.user.id) | Q(user_id=None), alert_rule=alert_rule
    ).first()
    if rule_snooze:
        serialized_rule["snooze"] = True
        if request.user.id == rule_snooze.owner_id:
            serialized_rule["snoozeCreatedBy"] = "You"
        else:
            user = user_service.get_user(rule_snooze.owner_id)
            if user:
                serialized_rule["snoozeCreatedBy"] = user.get_display_name()
        serialized_rule["snoozeForEveryone"] = rule_snooze.user_id is None

    return Response(serialized_rule)


def update_alert_rule(request: Request, organization, alert_rule):
    data = request.data
    organization_id = data.get("organizationId")
    if not organization_id:
        project_slugs = data.get("projects")
        if project_slugs:
            projects = Project.objects.filter(slug__in=project_slugs)
            if not projects:
                return Response(
                    "Must pass organizationId or projects in request data",
                    status=status.HTTP_400_BAD_REQUEST,
                )
            organization_id = projects[0].organization_id
    serializer = DrfAlertRuleSerializer(
        context={
            "organization": organization,
            "access": request.access,
            "user": request.user,
            "ip_address": request.META.get("REMOTE_ADDR"),
            "installations": app_service.get_installed_for_organization(
                organization_id=organization_id
            ),
        },
        instance=alert_rule,
        data=data,
        partial=True,
    )
    if serializer.is_valid():
        trigger_sentry_app_action_creators_for_incidents(serializer.validated_data)
        if get_slack_actions_with_async_lookups(organization, request.user, data):
            # need to kick off an async job for Slack
            client = RedisRuleStatus()
            task_args = {
                "organization_id": organization_id,
                "uuid": client.uuid,
                "data": data,
                "alert_rule_id": alert_rule.id,
                "user_id": request.user.id,
            }
            find_channel_id_for_alert_rule.apply_async(kwargs=task_args)
            # The user has requested a new Slack channel and we tell the client to check again in a bit
            return Response({"uuid": client.uuid}, status=202)
        else:
            alert_rule = serializer.save()
            return Response(serialize(alert_rule, request.user), status=status.HTTP_200_OK)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def remove_alert_rule(request: Request, organization, alert_rule):
    try:
        delete_alert_rule(alert_rule, user=request.user, ip_address=request.META.get("REMOTE_ADDR"))
        return Response(status=status.HTTP_204_NO_CONTENT)
    except AlreadyDeletedError:
        return Response("This rule has already been deleted", status=status.HTTP_400_BAD_REQUEST)


class OrganizationAlertRuleDetailsPutSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False, help_text="The name for the rule.")
    aggregate = serializers.CharField(
        required=False, help_text="A string representing the aggregate used in this alert rule."
    )
    queryType = serializers.ChoiceField(
        required=False,
        choices=((0, "event.type:error"), (1, "event.type:transaction"), (2, "")),
        help_text="The `SnubaQuery.Type` of the query. If no value is provided, `queryType` is set to the default for the specified `dataset.`",
    )
    dataset = serializers.CharField(
        required=False,
        help_text="The name of the dataset that this query will be executed on. Valid values are `events`, `transactions`, `metrics`, `sessions`, and `generic-metrics`.",
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
        required=False,
        help_text="The time period to aggregate over.",
    )
    projects = serializers.ListField(
        child=ProjectField(scope="project:read"),
        required=False,
        help_text="The names of the projects to filter by.",
    )
    environment = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The name of the environment to filter by.",
    )
    eventTypes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="List of event types that this alert will be related to. Valid values are `error` and `transaction`.",
    )
    query = serializers.CharField(
        required=False,
        help_text='An event search query to subscribe to and monitor for alerts. For example, to filter transactions so that only those with status code 400 are included, you could use `"query": "http.status_code:400"`. Use an empty string for no filter.',
    )
    comparisonDelta = serializers.IntegerField(
        required=False,
        help_text='An optional int representing the time delta to use to determine the comparison period, in minutes. Required when using a percentage change threshold ("x%" higher or lower compared to `comparisonDelta` minutes ago). A percentage change threshold cannot be used for [Crash Free Session Rate](/api/events/create-a-metric-alert-rule-for-an-organization#crash-free-session-rate) or [Crash Free User Rate](/api/events/create-a-metric-alert-rule-for-an-organization#crash-free-user-rate).',
    )
    thresholdType = serializers.ChoiceField(
        choices=((0, "Above"), (1, "Below")),
        required=False,
        help_text='The comparison operator for the critical and warning thresholds. The comparison operator for the resolved threshold is automatically set to the opposite operator. When a percentage change threshold is used, `0` is equivalent to "Higher than" and `1` is equivalent to "Lower than".',
    )
    triggers = serializers.ListField(
        required=False,
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
- `targetIdentifier`: The ID of the target. This is required as an integer for PagerDuty and Sentry apps, and as a string for all others. Examples of appropriate values include a Slack channel name (`#my-channel`), a user ID, a team ID, a Sentry app ID, etc.
- `inputChannelId`: The ID of the Slack channel. This is only used for the Slack action, and can be used as an alternative to providing the `targetIdentifier`.
- `integrationId`: The integration ID. This is required for every action type excluding `email` and `sentry_app.`
- `sentryAppId`: The ID of the Sentry app. This is required when `type` is `sentry_app`.
""",
    )
    resolveThreshold = serializers.FloatField(
        required=False,
        help_text="Optional value that the subscription needs to reach to resolve the alert. If `thresholdType` is `0`, `resolveThreshold` must be greater than the critical threshold, otherwise, it must be less than the critical threshold.",
    )
    owner = ActorField(
        required=False, allow_null=True, help_text="The ID of the team or user that owns the rule."
    )


@extend_schema(tags=["Events"])
@region_silo_endpoint
class OrganizationAlertRuleDetailsEndpoint(OrganizationAlertRuleEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    def check_project_access(func):
        def wrapper(self, request: Request, organization, alert_rule):
            # a metric alert is only associated with one project at a time
            project = alert_rule.snuba_query.subscriptions.get().project

            if not request.access.has_project_access(project):
                return Response(status=status.HTTP_403_FORBIDDEN)

            return func(self, request, organization, alert_rule)

        return wrapper

    @extend_schema(
        operation_id="Retrieve a Metric Alert Rule for an Organization",
        parameters=[GlobalParams.ORG_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            200: RESPONSE_ACCEPTED,  # TODO: BLOCKED, NEED AlertRuleModelSerializer
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        # examples=MetricAlertExamples.GET_ORG_RULE  # TODO: BLOCKED
    )
    @check_project_access
    def get(self, request: Request, organization, alert_rule) -> Response:
        """
        Return details on an individual metric alert rule.

        TODO: add whatever description is used in OrganizationAlertRuleIndexEndpoint
        """
        return fetch_alert_rule(request, organization, alert_rule)

    @extend_schema(
        operation_id="Update a Metric Alert Rule",
        parameters=[GlobalParams.ORG_SLUG, MetricAlertParams.METRIC_RULE_ID],
        request=OrganizationAlertRuleDetailsPutSerializer,
        responses={
            200: RESPONSE_ACCEPTED,  # TODO: BLOCKED, NEED AlertRuleModelSerializer
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        # examples=MetricAlertExamples.UPDATE_PROJECT_RULE  # TODO: BLOCKED
    )
    @check_project_access
    def put(self, request: Request, organization, alert_rule) -> Response:
        """
        Update a metric alert rule. Only the attributes submitted are modified.

        TODO: add whatever description is used in OrganizationAlertRuleIndexEndpoint
        """
        return update_alert_rule(request, organization, alert_rule)

    @extend_schema(
        operation_id="Delete a Metric Alert Rule",
        parameters=[GlobalParams.ORG_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @check_project_access
    def delete(self, request: Request, organization, alert_rule) -> Response:
        """
        Delete a specific metric alert rule.

        TODO: add whatever description is used in OrganizationAlertRuleIndexEndpoint
        """
        return remove_alert_rule(request, organization, alert_rule)
