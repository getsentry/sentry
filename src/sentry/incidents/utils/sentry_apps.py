from typing import Any, Mapping

from rest_framework import serializers

from sentry.incidents.logic import get_filtered_actions
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.mediators import alert_rule_actions
from sentry.models import SentryAppInstallation


def trigger_sentry_app_action_creators_for_incidents(
    validated_alert_rule_data: Mapping[str, Any]
) -> None:

    sentry_app_actions = get_filtered_actions(
        validated_alert_rule_data=validated_alert_rule_data,
        action_type=AlertRuleTriggerAction.Type.SENTRY_APP,
    )
    for action in sentry_app_actions:
        install = SentryAppInstallation.objects.get(uuid=action.get("sentry_app_installation_uuid"))
        result = alert_rule_actions.AlertRuleActionCreator.run(
            install=install,
            fields=action.get("sentry_app_config"),
        )

        if not result["success"]:
            raise serializers.ValidationError({"sentry_app": result["message"]})
