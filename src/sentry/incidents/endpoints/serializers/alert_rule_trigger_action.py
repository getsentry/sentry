from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.workflow_engine.utils.legacy_metric_tracking import report_used_legacy_models

logger = logging.getLogger(__name__)


def human_desc(
    action_type: int,
    target_identifier: str | None,
    target: OrganizationMember | Team | str | None,
    target_display: str | None = None,
    priority: str | None = None,
) -> str | None:
    """Return a human-readable description of a metric alert action for display in the UI.

    Args:
        action_type: An ``ActionService`` enum value (e.g. EMAIL, SLACK, PAGERDUTY).
        priority: On-call severity/priority string when applicable.
            PagerDuty: "default", "critical", "warning", "error", "info".
            Opsgenie: "P1"–"P5".
    """
    if priority:
        priority += " level"

    slack_desc = f"Send a Slack notification to {target_display}"
    action_type_to_string = {
        AlertRuleTriggerAction.Type.PAGERDUTY.value: (
            f"Send a {priority} PagerDuty notification to {target_display}"
            if priority
            else f"Send a PagerDuty notification to {target_display}"
        ),
        AlertRuleTriggerAction.Type.SLACK.value: slack_desc,
        AlertRuleTriggerAction.Type.SLACK_STAGING.value: slack_desc,
        AlertRuleTriggerAction.Type.MSTEAMS.value: f"Send a Microsoft Teams notification to {target_display}",
        AlertRuleTriggerAction.Type.SENTRY_APP.value: f"Send a notification via {target_display}",
    }

    if action_type == AlertRuleTriggerAction.Type.EMAIL.value:
        if isinstance(target, OrganizationMember):
            return "Send a notification to " + target.get_email()
        elif isinstance(target, Team):
            return "Send an email to members of #" + target.slug
        logger.info("email.action.description.no_action_target")
        return "Send an email to [removed]"
    elif action_type == AlertRuleTriggerAction.Type.OPSGENIE.value:
        if priority:
            return f"Send a {priority} Opsgenie notification to {target_display}"
        return f"Send an Opsgenie notification to {target_display}"
    elif action_type == AlertRuleTriggerAction.Type.DISCORD.value:
        if not target_display:
            logger.info(
                "discord.action.description.no.channel",
                extra={"target_identifier": target_identifier},
            )
        return f"Send a Discord notification to {target_display}"
    else:
        return action_type_to_string.get(action_type)


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
    return (
        target_identifier
        if action_type
        in (
            AlertRuleTriggerAction.Type.SLACK.value,
            AlertRuleTriggerAction.Type.SLACK_STAGING.value,
        )
        else None
    )


@register(AlertRuleTriggerAction)
class AlertRuleTriggerActionSerializer(Serializer[dict[str, Any]]):
    def serialize(
        self,
        obj: AlertRuleTriggerAction,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[str, Any]:
        # Mark that we're using legacy AlertRuleTriggerAction models
        report_used_legacy_models()

        from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING

        priority: str | None = (
            obj.sentry_app_config.get("priority")
            if isinstance(obj.sentry_app_config, dict)
            else None
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
                obj.target_identifier,
                obj.target,
                obj.target_display,
                priority,
            ),
            "priority": priority,
        }

        # Check if action is a Sentry App that has Alert Rule UI Component settings
        if obj.sentry_app_id and obj.sentry_app_config:
            result["settings"] = obj.sentry_app_config

        return result
