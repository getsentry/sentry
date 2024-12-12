from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.auth.access import NoAccess
from sentry.constants import SENTRY_APP_ACTIONS
from sentry.incidents.logic import get_filtered_actions
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.serializers import AlertRuleTriggerActionSerializer
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult
from sentry.sentry_apps.utils.errors import (
    SentryAppError,
    SentryAppErrorType,
    SentryAppIntegratorError,
)


def raise_alert_rule_action_result_errors(result: RpcAlertRuleActionResult) -> None:
    if result.error_type is None:
        return None

    error_type = SentryAppErrorType(result.error_type)
    match error_type:
        case SentryAppErrorType.INTEGRATOR:
            raise SentryAppIntegratorError(result.message)
        case SentryAppErrorType.CLIENT:
            raise SentryAppError(result.message)
        case SentryAppErrorType.SENTRY:
            raise Exception(result.message)


def create_sentry_app_alert_rule_component_for_incidents(
    serialized_data: Mapping[str, Any]
) -> Response | None:
    try:
        trigger_sentry_app_action_creators_for_incidents(serialized_data)
    except (SentryAppError, SentryAppIntegratorError) as e:
        return Response(
            str(e),
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        error_id = sentry_sdk.capture_exception(e)
        return Response(
            f"Something went wrong while trying to create alert rule action. Sentry error ID: {error_id}",
            status=500,
        )


def create_sentry_app_alert_rule_issues_component(
    actions: Sequence[Mapping[str, Any]]
) -> str | Response:
    try:
        created = trigger_sentry_app_action_creators_for_issues(actions)

    except (SentryAppError, SentryAppIntegratorError) as e:
        return Response(
            {"actions": [str(e)]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        error_id = sentry_sdk.capture_exception(e)
        return Response(
            {
                "actions": [
                    f"Something went wrong while trying to create alert rule action. Sentry error ID: {error_id}"
                ]
            },
            status=500,
        )
    return created


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
        raise_alert_rule_action_result_errors(result)


def trigger_sentry_app_action_creators_for_issues(
    actions: Sequence[Mapping[str, Any]]
) -> str | None:
    created = None
    for action in actions:
        # Only call creator for Sentry Apps with UI Components for alert rules.
        if not action.get("id") in SENTRY_APP_ACTIONS:
            continue

        result = app_service.trigger_sentry_app_action_creators(
            fields=action["settings"], install_uuid=action.get("sentryAppInstallationUuid")
        )
        raise_alert_rule_action_result_errors(result=result)
        created = "alert-rule-action"
    return created
