from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import int, Any

from sentry.constants import SENTRY_APP_ACTIONS
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.utils.alert_rule_action import raise_alert_rule_action_result_errors


def validate_sentry_app_action(action: Mapping[str, Any]) -> str:
    result = app_service.trigger_sentry_app_action_creators(
        fields=action["settings"], install_uuid=action.get("sentryAppInstallationUuid")
    )
    # Bubble up errors from Sentry App to the UI
    if not result.success:
        raise_alert_rule_action_result_errors(result)

    return "alert-rule-action"


def trigger_sentry_app_action_creators_for_issues(
    actions: Sequence[Mapping[str, Any]],
) -> str | None:
    created = None
    for action in actions:
        # Only call creator for Sentry Apps with UI Components for alert rules.
        if action.get("id") not in SENTRY_APP_ACTIONS:
            continue

        created = validate_sentry_app_action(action)
    return created
