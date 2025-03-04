import logging

from sentry.api.serializers import Serializer, register
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction

logger = logging.getLogger(__name__)


def human_desc(
    action_type,
    target_type,
    target_identifier,
    target,
    target_display=None,
    action_target=None,
    priority=None,
):
    # Returns a human readable description to display in the UI
    if priority:
        priority += " level"

    action_type_to_string = {
        AlertRuleTriggerAction.Type.PAGERDUTY.value: f"Send a {priority} PagerDuty notification to {target_display}",
        AlertRuleTriggerAction.Type.SLACK.value: f"Send a Slack notification to {target_display}",
        AlertRuleTriggerAction.Type.MSTEAMS.value: f"Send a Microsoft Teams notification to {target_display}",
        AlertRuleTriggerAction.Type.SENTRY_APP.value: f"Send a notification via {target_display}",
    }

    if action_type == AlertRuleTriggerAction.Type.EMAIL.value:
        if action_target:
            if target_type == AlertRuleTriggerAction.TargetType.USER.value:
                return "Send a notification to " + target.email
            elif target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
                return "Send an email to members of #" + target.slug
    elif action_type == AlertRuleTriggerAction.Type.OPSGENIE.value:
        if priority:
            return f"Send a {priority} Opsgenie notification to {target_display}"
        return "Send an Opsgenie notification to {target_display}"
    elif action_type == AlertRuleTriggerAction.Type.DISCORD.value:
        if not target_display:
            logger.info(
                "discord.action.description.no.channel",
                extra={"target_identifier": target_identifier},
            )
        return f"Send a Discord notification to {target_display}"
    else:
        return action_type_to_string[action_type]


def get_identifier_from_action(action_type, target_identifier, target_display=None):
    if action_type in [
        AlertRuleTriggerAction.Type.PAGERDUTY.value,
        AlertRuleTriggerAction.Type.SENTRY_APP.value,
    ]:
        return int(target_identifier)
    if action_type == AlertRuleTriggerAction.Type.OPSGENIE.value:
        # return team ID: opsgenie team IDs are strings
        return target_identifier
    # if an input_channel_id is provided, we flip these to display properly
    return target_display if target_display is not None else target_identifier


def get_input_channel_id(action_type, target_identifier=None):
    """
    Don't pass an inputChannelId value unless the action is for Slack
    """
    return target_identifier if action_type == AlertRuleTriggerAction.Type.SLACK.value else None


@register(AlertRuleTriggerAction)
class AlertRuleTriggerActionSerializer(Serializer):

    def serialize(self, obj, attrs, user, **kwargs):
        from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING

        priority = (
            obj.sentry_app_config.get("priority") if isinstance(obj.sentry_app_config, dict) else ""
        )
        result = {
            "id": str(obj.id),
            "alertRuleTriggerId": str(obj.alert_rule_trigger_id),
            "type": AlertRuleTriggerAction.get_registered_factory(
                AlertRuleTriggerAction.Type(obj.type)
            ).slug,
            "targetType": ACTION_TARGET_TYPE_TO_STRING[
                AlertRuleTriggerAction.TargetType(obj.target_type)
            ],
            "targetIdentifier": get_identifier_from_action(
                obj.type, obj.target_identifier, obj.target_display
            ),
            "inputChannelId": get_input_channel_id(obj.type, obj.target_identifier),
            "integrationId": obj.integration_id,
            "sentryAppId": obj.sentry_app_id,
            "dateCreated": obj.date_added,
            "desc": human_desc(
                obj.type,
                obj.target_type,
                obj.target_identifier,
                obj.target,
                obj.target_display,
                obj.target,
                priority,
            ),
            "priority": (
                obj.sentry_app_config.get("priority", None)
                if isinstance(obj.sentry_app_config, dict)
                else None
            ),
        }

        # Check if action is a Sentry App that has Alert Rule UI Component settings
        if obj.sentry_app_id and obj.sentry_app_config:
            result["settings"] = obj.sentry_app_config

        return result
