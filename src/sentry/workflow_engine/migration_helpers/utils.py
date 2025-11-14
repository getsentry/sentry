from typing import int, cast

from sentry.incidents.models.alert_rule import AlertRule, AlertRuleTrigger, AlertRuleTriggerAction
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.types import DetectorPriorityLevel

MAX_ACTIONS = 3

ACTION_TYPE_TO_STRING = {
    AlertRuleTriggerAction.Type.PAGERDUTY.value: "PagerDuty",
    AlertRuleTriggerAction.Type.SLACK.value: "Slack",
    AlertRuleTriggerAction.Type.MSTEAMS.value: "Microsoft Teams",
    AlertRuleTriggerAction.Type.OPSGENIE.value: "Opsgenie",
    AlertRuleTriggerAction.Type.DISCORD.value: "Discord",
}


def get_resolve_threshold(condition_group: DataConditionGroup) -> float:
    """
    Returns the resolution threshold for a static or percent-based metric issue
    """
    resolve_condition = DataCondition.objects.get(
        condition_result=DetectorPriorityLevel.OK, condition_group=condition_group
    )
    return resolve_condition.comparison


def get_action_description(action: AlertRuleTriggerAction) -> str:
    """
    Returns a human readable action description
    """

    if action.type == AlertRuleTriggerAction.Type.EMAIL.value:
        if action.target:
            if action.target_type == AlertRuleTriggerAction.TargetType.USER.value:
                action_target_user = cast(OrganizationMember, action.target)
                return "Email " + action_target_user.get_email()
            elif action.target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
                action_target_team = cast(Team, action.target)
                return "Email #" + action_target_team.slug
        else:
            return "Email [removed]"
    elif action.type == AlertRuleTriggerAction.Type.SENTRY_APP.value:
        return f"Notify {action.target_display}"

    return f"Notify {action.target_display} via {ACTION_TYPE_TO_STRING[action.type]}"


def get_workflow_name(alert_rule: AlertRule) -> str:
    """
    Generate a workflow name like 'Slack @michelle.fu, Email michelle.fu@sentry.io...(+3)' if there is only a critical trigger
    or with priority label: 'Critical - Slack @michelle.fu, Warning email michelle.fu@sentry.io...(+3)''
    """
    name = ""
    triggers = AlertRuleTrigger.objects.filter(alert_rule_id=alert_rule.id).order_by("label")
    include_label = False if triggers.count() == 1 else True

    actions = AlertRuleTriggerAction.objects.filter(
        alert_rule_trigger_id__in=[trigger.id for trigger in triggers]
    )
    actions_counter = 0

    for trigger in triggers:
        name += f"{trigger.label.title()} - " if include_label else ""
        for action in actions.filter(alert_rule_trigger_id=trigger.id):
            description = get_action_description(action) + ", "

            if actions_counter < MAX_ACTIONS:
                name += description
                actions_counter += 1
            else:
                remaining_actions = actions.count() - actions_counter
                name = name[:-2]
                name += f"...(+{remaining_actions})"
                break

    if name[-2:] == ", ":
        name = name[:-2]  # chop off the trailing comma

    return name
