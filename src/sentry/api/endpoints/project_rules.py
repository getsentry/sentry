from typing import List

from django.conf import settings
from django.db.models.signals import pre_save
from django.dispatch import receiver
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.fields.actor import ActorField
from sentry.api.serializers import serialize
from sentry.api.serializers.models.rule import RuleSerializer, RuleSerializerResponse
from sentry.api.serializers.rest_framework.rule import RuleNodeField
from sentry.api.serializers.rest_framework.rule import RuleSerializer as DrfRuleSerializer
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.issue_alert_examples import IssueAlertExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.mediators.project_rules.creator import Creator
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.models.team import Team
from sentry.models.user import User
from sentry.rules.actions import trigger_sentry_app_action_creators_for_issues
from sentry.rules.processor import is_condition_slow
from sentry.signals import alert_rule_created
from sentry.tasks.integrations.slack import find_channel_id_for_rule
from sentry.web.decorators import transaction_start


def clean_rule_data(data):
    for datum in data:
        if datum.get("name"):
            del datum["name"]


@receiver(pre_save, sender=Rule)
def pre_save_rule(instance, sender, *args, **kwargs):
    clean_rule_data(instance.data.get("conditions", []))
    clean_rule_data(instance.data.get("actions", []))


def find_duplicate_rule(project, rule_data=None, rule_id=None, rule=None):
    if rule:
        rule_data = rule.data

    matchers = {key for key in list(rule_data.keys()) if key not in ("name", "user_id")}
    extra_fields = ["actions", "environment"]
    matchers.update(extra_fields)
    existing_rules = Rule.objects.exclude(id=rule_id).filter(
        project=project, status=ObjectStatus.ACTIVE
    )

    for existing_rule in existing_rules:
        keys = 0
        matches = 0
        for matcher in matchers:
            if existing_rule.data.get(matcher) and rule_data.get(matcher):
                keys += 1

                if existing_rule.data[matcher] == rule_data[matcher]:
                    matches += 1

            elif matcher in extra_fields:
                if matcher == "environment":
                    if rule:
                        # we have to compare env data differently if coming from db rather than app
                        if existing_rule.environment_id and rule.environment_id:
                            keys += 1
                            if existing_rule.environment_id == rule.environment_id:
                                matches += 1
                        elif (
                            existing_rule.environment_id
                            and not rule.environment_id
                            or not existing_rule.environment_id
                            and rule.environment_id
                        ):
                            keys += 1

                    else:
                        if existing_rule.environment_id and rule_data.get(matcher):
                            keys += 1
                            if existing_rule.environment_id == rule_data.get(matcher):
                                matches += 1
                        elif (
                            existing_rule.environment_id
                            and not rule_data.get(matcher)
                            or not existing_rule.environment_id
                            and rule_data.get(matcher)
                        ):
                            keys += 1
                elif not existing_rule.data.get(matcher) and not rule_data.get(matcher):
                    # neither rule has the matcher
                    continue

                else:
                    # one rule has the matcher and the other one doesn't
                    keys += 1

        if keys == matches:
            return existing_rule
    return None


class ProjectRulesPostSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, help_text="The name for the rule.")
    actionMatch = serializers.ChoiceField(
        choices=(
            ("all", "All conditions must evaluate to true."),
            ("any", "At least one of the conditions must evaluate to true."),
            ("none", "All conditions must evaluate to false."),
        ),
        help_text="A string determining which of the conditions need to be true before any filters are evaluated.",
    )
    conditions = serializers.ListField(
        child=RuleNodeField(type="condition/event"),
        help_text="""
A list of triggers that determine when the rule fires. See below for a list of possible conditions.

**A new issue is created**
```json
{
    "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
}
```

**The issue changes state from resolved to unresolved**
```json
{
    "id": "sentry.rules.conditions.regression_event.RegressionEventCondition"
}
```

**The issue is seen more than `value` times in `interval`**
- `value` - An integer
- `interval` - Valid values are `1m`, `5m`, `15m`, `1h`, `1d`, `1w` and `30d` (`m` for minutes, `h` for hours, `d` for days, and `w` for weeks).
```json
{
    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
    "value": 500,
    "interval": "1h"
}
```

**The issue is seen by more than `value` users in `interval`**
- `value` - An integer
- `interval` - Valid values are `1m`, `5m`, `15m`, `1h`, `1d`, `1w` and `30d` (`m` for minutes, `h` for hours, `d` for days, and `w` for weeks).
```json
{
    "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
    "value": 1000,
    "interval": "15m"
}
```

**The issue affects more than `value` percent of sessions in `interval`**
- `value` - An integer from 0 to 100
- `interval` - Valid values are `5m`, `10m`, `30m`, and `1h` (`m` for minutes, `h` for hours).
```json
{
    "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
    "value": 50,
    "interval": "10m"
}
```
""",
    )
    actions = serializers.ListField(
        child=RuleNodeField(type="action/event"),
        help_text="""
A list of actions that take place when all required conditions and filters for the rule are met. See below for a list of possible actions.

**Send a notification to Suggested Assignees**
- `fallthroughType` - Who the notification should be sent to if there are no suggested assignees. Valid values are `ActiveMembers`, `AllMembers`, and `NoOne`.
```json
{
    "id" - "sentry.mail.actions.NotifyEmailAction",
    "targetType" - "IssueOwners",
    "fallthroughType" - "ActiveMembers"
}
```

**Send a notification to a Member or a Team**
- `targetType` - One of `Member` or `Team`.
- `fallthroughType` - Who the notification should be sent to if it cannot be sent to the original target. Valid values are `ActiveMembers`, `AllMembers`, and `NoOne`.
- `targetIdentifier` - The ID of the Member or Team the notification should be sent to.
```json
{
    "id": "sentry.mail.actions.NotifyEmailAction",
    "targetType": "Team"
    "fallthroughType": "AllMembers"
    "targetIdentifier": 4524986223
}
```

**Send a Slack notification**
- `workspace` - The integration ID associated with the Slack workspace.
- `channel` - The name of the channel to send the notification to (e.g., #critical, Jane Schmidt).
- `channel_id` (optional) - The ID of the channel to send the notification to.
- `tags` - A string of tags to show in the notification, separated by commas (e.g., "environment, user, my_tag").
```json
{
    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
    "workspace": 293854098,
    "channel": "#warning",
    "tags": "environment,level"
}
```

**Send a Microsoft Teams notification**
- `team` - The integration ID associated with the Microsoft Teams team.
- `channel` - The name of the channel to send the notification to.
```json
{
    "id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
    "team": 23465424,
    "channel": "General"
}
```

**Send a Discord notification**
- `server` - The integration ID associated with the Discord server.
- `channel_id` - The ID of the channel to send the notification to.
- `tags` - A string of tags to show in the notification, separated by commas (e.g., "environment, user, my_tag").
```json
{
    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
    "server": 63408298,
    "channel_id": 94732897,
    "tags": "browser,user"
}
```

**Create a Jira Ticket**
- `integration` - The integration ID associated with Jira.
- `project` - The ID of the Jira project.
- `issuetype` - The ID of the type of issue that the ticket should be created as.
- `dynamic_form_fields` (optional) - A list of any custom fields you want to include in the ticket as objects.
```json
{
    "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
    "integration": 321424,
    "project": "349719"
    "issueType": "1"
}
```

**Create a Jira Server Ticket**
- `integration` - The integration ID associated with Jira Server.
- `project` - The ID of the Jira Server project.
- `issuetype` - The ID of the type of issue that the ticket should be created as.
- `dynamic_form_fields` (optional) - A list of any custom fields you want to include in the ticket as objects.
```json
{
    "id": "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
    "integration": 321424,
    "project": "349719"
    "issueType": "1"
}
```

**Create a GitHub Issue**
- `integration` - The integration ID associated with GitHub.
- `repo` - The name of the repository to create the issue in.
- `title` - The title of the issue.
- `body` (optional) - The contents of the issue.
- `assignee` (optional) - The GitHub user to assign the issue to.
- `labels` (optional) - A list of labels to assign to the issue.
```json
{
    "id": "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
    "integration": 93749,
    "repo": default,
    "title": "My Test Issue",
    "assignee": "Baxter the Hacker",
    "labels": ["bug", "p1"]
    ""
}
```

**Create an Azure DevOps work item**
- `integration` - The integration ID.
- `project` - The ID of the Azure DevOps project.
- `work_item_type` - The type of work item to create.
- `dynamic_form_fields` (optional) - A list of any custom fields you want to include in the work item as objects.
```json
{
    "id": "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
    "integration": 294838,
    "project": "0389485",
    "work_item_type": "Microsoft.VSTS.WorkItemTypes.Task",
}
```

**Send a PagerDuty notification**
- `account` - The integration ID associated with the PagerDuty account.
- `service` - The ID of the service to send the notification to.
```json
{
    "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
    "account": 92385907,
    "service": 9823924
}
```

**Send an Opsgenie notification**
- `account` - The integration ID associated with the Opsgenie account.
- `team` - The ID of the Opsgenie team to send the notification to.
```json
{
    "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
    "account": 8723897589,
    "team": "9438930258-fairy"
}
```

**Send a notification to a service**
- `service` - The plugin slug.
```json
{
    "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
    "service": "mail"
}
```

**Send a notification to a Sentry app with a custom webhook payload**
- `settings` - A list of objects denoting the settings each action will be created with. All required fields must be included.
- `sentryAppInstallationUuid` - The ID for the Sentry app
```json
{
    "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
    "settings": [
        {"name": "title", "value": "Team Rocket"},
        {"name": "summary", "value": "We're blasting off again."},
    ],
    "sentryAppInstallationUuid": 643522
    "hasSchemaFormConfig": true
}
```

**Send a notification (for all legacy integrations)**
```json
{
    "id": "sentry.rules.actions.notify_event.NotifyEventAction"
}
```
""",
    )
    frequency = serializers.IntegerField(
        min_value=5,
        max_value=60 * 24 * 30,
        help_text="How often to perform the actions once for an issue, in minutes. The valid range is `5` to `43200`.",
    )
    environment = serializers.CharField(
        required=False, allow_null=True, help_text="The name of the environment to filter by."
    )
    filterMatch = serializers.ChoiceField(
        choices=(
            ("all", "All filters must evaluate to true."),
            ("any", "At least one of the filters must evaluate to true."),
            ("none", "All filters must evaluate to false."),
        ),
        required=False,
        help_text="A string determining which filters need to be true before any actions take place. Required when a value is provided for `filters`.",
    )
    filters = serializers.ListField(
        child=RuleNodeField(type="filter/event"),
        required=False,
        help_text="""
A list of filters that determine if a rule fires after the necessary conditions have been met. See below for a list of possible filters.

**The issue is `comparison_type` than `value` `time`**
- `comparison_type` - One of `older` or `newer`
- `value` - An integer
- `time` - The unit of time. Valid values are `minute`, `hour`, `day`, and `week`.
```json
{
    "id": "sentry.rules.filters.age_comparison.AgeComparisonFilter",
    "comparison_type": "older",
    "value": 3,
    "time": "week"
}
```

**The issue has happened at least `value` times**
- `value` - An integer
```json
{
    "id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",
    "value": 120
}
```

**The issue is assigned to No One**
```json
{
    "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
    "targetType": "Unassigned"
}
```

**The issue is assigned to `targetType`**
- `targetType` - One of `Team` or `Member`
- `targetIdentifier` - The target's ID
```json
{
    "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
    "targetType": "Member",
    "targetIdentifier": 895329789
}
```

**The event is from the latest release**
```json
{
    "id": "sentry.rules.filters.latest_release.LatestReleaseFilter"
}
```

**The issue's category is equal to `value`**
- `value` - An integer correlated with a category. Valid values are `1` (Error), `2` (Performance), `3` (Profile), `4` (Cron), and `5` (Replay).
```json
{
    "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
    "value": 2
}
```

**The event's `attribute` value `match` `value`**
- `attribute` - Valid values are `message`, `platform`, `environment`, `type`, `error.handled`, `error.unhandled`, `error.main_thread`, `exception.type`, `exception.value`, `user.id`, `user.email`, `user.username`, `user.ip_address`, `http.method`, `http.url`, `http.status_code`, `sdk.name`, `stacktrace.code`, `stacktrace.module`, `stacktrace.filename`, `stacktrace.abs_path`, `stacktrace.package`, `unreal.crashtype`, and `app.in_foreground`.
- `match` - The comparison operator. Valid values are `eq` (equals), `ne` (does not equal), `sw` (starts with), `ew` (ends with), `co` (contains), `nc` (does not contain), `is` (is set), and `ns` (is not set).
- `value` - A string. Not required when `match` is `is` or `ns`.
```json
{
    "id": "sentry.rules.conditions.event_attribute.EventAttributeCondition",
    "attribute": "http.url",
    "match": "nc",
    "value": "localhost"
}
```

**The event's tags match `key` `match` `value`**
- `key` - The tag
- `match` - The comparison operator. Valid values are `eq` (equals), `ne` (does not equal), `sw` (starts with), `ew` (ends with), `co` (contains), `nc` (does not contain), `is` (is set), and `ns` (is not set).
- `value` - A string. Not required when `match` is `is` or `ns`.
```json
{
    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
    "key": "level",
    "match": "eq"
    "value": "error"
}
```

**The event's level is `match` `level`**
- `match` - Valid values are `eq`, `gte`, and `lte`.
- `level` - Valid values are `50` (fatal), `40` (error), `30` (warning), `20` (info), `10` (debug), `0` (sample).
```json
{
    "id": "sentry.rules.filters.level.LevelFilter",
    "match": "gte"
    "level": "50"
}
```
""",
    )
    owner = ActorField(
        required=False, allow_null=True, help_text="The ID of the team or user that owns the rule."
    )


@extend_schema(tags=["Alerts"])
@region_silo_endpoint
class ProjectRulesEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (ProjectAlertRulePermission,)

    @extend_schema(
        operation_id="List a Project's Issue Alert Rules",
        parameters=[GlobalParams.ORG_SLUG, GlobalParams.PROJECT_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer("ListRules", List[RuleSerializerResponse]),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueAlertExamples.LIST_PROJECT_RULES,
    )
    @transaction_start("ProjectRulesEndpoint")
    def get(self, request: Request, project) -> Response:
        """
        Return a list of active issue alert rules bound to a project.

        An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
        - Triggers: specify what type of activity you'd like monitored or when an alert should be triggered.
        - Filters: help control noise by triggering an alert only if the issue matches the specified criteria.
        - Actions: specify what should happen when the trigger conditions are met and the filters match.
        """
        queryset = Rule.objects.filter(
            project=project,
            status=ObjectStatus.ACTIVE,
        ).select_related("project")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-id",
            on_results=lambda x: serialize(x, request.user),
        )

    @extend_schema(
        operation_id="Create an Issue Alert Rule for a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
        ],
        request=ProjectRulesPostSerializer,
        responses={
            201: RuleSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueAlertExamples.CREATE_ISSUE_ALERT_RULE,
    )
    @transaction_start("ProjectRulesEndpoint")
    def post(self, request: Request, project) -> Response:
        """
        Create a new issue alert rule for the given project.

        An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
        - Triggers: specify what type of activity you'd like monitored or when an alert should be triggered.
        - Filters: help control noise by triggering an alert only if the issue matches the specified criteria.
        - Actions: specify what should happen when the trigger conditions are met and the filters match.
        """

        serializer = DrfRuleSerializer(
            context={"project": project, "organization": project.organization}, data=request.data
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        if not data.get("actions", []):
            return Response(
                {
                    "actions": [
                        "You must add an action for this alert to fire.",
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        # combine filters and conditions into one conditions criteria for the rule object
        conditions = data.get("conditions", [])
        if "filters" in data:
            conditions.extend(data["filters"])

        new_rule_is_slow = False
        for condition in conditions:
            if is_condition_slow(condition):
                new_rule_is_slow = True
                break

        rules = Rule.objects.filter(project=project, status=ObjectStatus.ACTIVE)
        slow_rules = 0
        for rule in rules:
            for condition in rule.data["conditions"]:
                if is_condition_slow(condition):
                    slow_rules += 1
                    break

        if new_rule_is_slow:
            max_slow_alerts = settings.MAX_SLOW_CONDITION_ISSUE_ALERTS
            if features.has("organizations:more-slow-alerts", project.organization):
                max_slow_alerts = settings.MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS
            if slow_rules >= max_slow_alerts:
                return Response(
                    {
                        "conditions": [
                            f"You may not exceed {max_slow_alerts} rules with this type of condition per project.",
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if (
            not new_rule_is_slow
            and (len(rules) - slow_rules) >= settings.MAX_FAST_CONDITION_ISSUE_ALERTS
        ):
            return Response(
                {
                    "conditions": [
                        f"You may not exceed {settings.MAX_FAST_CONDITION_ISSUE_ALERTS} rules with this type of condition per project.",
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        kwargs = {
            "name": data["name"],
            "environment": data.get("environment"),
            "project": project,
            "action_match": data["actionMatch"],
            "filter_match": data.get("filterMatch"),
            "conditions": conditions,
            "actions": data.get("actions", []),
            "frequency": data.get("frequency"),
            "user_id": request.user.id,
        }
        duplicate_rule = find_duplicate_rule(project=project, rule_data=kwargs)
        if duplicate_rule:
            return Response(
                {
                    "name": [
                        f"This rule is an exact duplicate of '{duplicate_rule.label}' in this project and may not be created.",
                    ],
                    "ruleId": [duplicate_rule.id],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        owner = data.get("owner")
        if owner:
            try:
                kwargs["owner"] = owner.resolve_to_actor().id
            except (User.DoesNotExist, Team.DoesNotExist):
                return Response(
                    "Could not resolve owner",
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if data.get("pending_save"):
            client = RedisRuleStatus()
            uuid_context = {"uuid": client.uuid}
            kwargs.update(uuid_context)
            find_channel_id_for_rule.apply_async(kwargs=kwargs)
            return Response(uuid_context, status=202)

        created_alert_rule_ui_component = trigger_sentry_app_action_creators_for_issues(
            kwargs["actions"]
        )
        rule = Creator.run(request=request, **kwargs)

        RuleActivity.objects.create(
            rule=rule, user_id=request.user.id, type=RuleActivityType.CREATED.value
        )
        duplicate_rule = request.query_params.get("duplicateRule")
        wizard_v3 = request.query_params.get("wizardV3")

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=rule.id,
            event=audit_log.get_event_id("RULE_ADD"),
            data=rule.get_audit_log_data(),
        )
        alert_rule_created.send_robust(
            user=request.user,
            project=project,
            rule=rule,
            rule_type="issue",
            sender=self,
            is_api_token=request.auth is not None,
            alert_rule_ui_component=created_alert_rule_ui_component,
            duplicate_rule=duplicate_rule,
            wizard_v3=wizard_v3,
        )

        return Response(serialize(rule, request.user))
