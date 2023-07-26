from typing import Any, Mapping

from rest_framework import serializers

from sentry.auth.access import NoAccess
from sentry.incidents.logic import get_filtered_actions
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.incidents.serializers import AlertRuleTriggerActionSerializer
from sentry.services.hybrid_cloud.app import app_service


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
            raise serializers.ValidationError({"sentry_app": result.message})
