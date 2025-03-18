from sentry.incidents.models.alert_rule import AlertRule, AlertRuleTrigger, AlertRuleTriggerAction

MAX_CHARS = 249  # (256 minus space for '...(+3)')


def get_action_description(action: AlertRuleTriggerAction) -> str:
    """
    Returns a human readable action description
    """
    action_type_to_string = {
        AlertRuleTriggerAction.Type.PAGERDUTY.value: f"PagerDuty to {action.target_display}",
        AlertRuleTriggerAction.Type.SLACK.value: f"Slack {action.target_display}",
        AlertRuleTriggerAction.Type.MSTEAMS.value: f"Microsoft Teams {action.target_display}",
        AlertRuleTriggerAction.Type.SENTRY_APP.value: f"Notify {action.target_display}",
    }

    if action.type == AlertRuleTriggerAction.Type.EMAIL.value:
        if action.target:
            if action.target_type == AlertRuleTriggerAction.TargetType.USER.value:
                return "Email " + action.target.email
            elif action.target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
                return "Email #" + action.target.slug
    elif action.type == AlertRuleTriggerAction.Type.OPSGENIE.value:
        return f"Opsgenie to {action.target_display}"
    elif action.type == AlertRuleTriggerAction.Type.DISCORD.value:
        return f"Discord to {action.target_display}"
    else:
        return action_type_to_string[action.type]


def get_workflow_name(alert_rule: AlertRule) -> str:
    """
    Generate a workflow name like 'Slack @michelle.fu, Email michelle.fu@sentry.io...(+3)' if there is only a critical trigger
    or with priority label: 'Critical - Slack @michelle.fu, Warning email michelle.fu@sentry.io...(+3)''
    """
    # we have to read from the old tables because at this point we may not have written to the new ones
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

            if len(name) + len(description) <= MAX_CHARS:
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
