from collections.abc import Mapping
from typing import Any

from rest_framework import serializers

from sentry.auth.access import NoAccess
from sentry.incidents.logic import get_filtered_actions
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.serializers import AlertRuleTriggerActionSerializer
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.utils.alert_rule_action import raise_alert_rule_action_result_errors


def trigger_sentry_app_action_creators_for_incidents(alert_rule_data: Mapping[str, Any]) -> None:
    sentry_app_actions = get_filtered_actions(
        alert_rule_data=alert_rule_data,
        action_type=AlertRuleTriggerAction.Type.SENTRY_APP,
    )
    # We're doing this so that Sentry Apps without alert-rule-action schemas still get saved
    sentry_app_actions_with_components = list(
        filter(lambda x: x.get("sentry_app_config"), sentry_app_actions)
    )

    for action in sentry_app_actions_with_components:
        action_serializer = AlertRuleTriggerActionSerializer(
            context={"access": NoAccess()},
            data=action,
        )
        if not action_serializer.is_valid():
            raise serializers.ValidationError(action_serializer.errors)

        result = app_service.trigger_sentry_app_action_creators(
            fields=action.get("sentry_app_config"),
            install_uuid=action.get("sentry_app_installation_uuid"),
        )

        if not result.success:
            raise_alert_rule_action_result_errors(result)
