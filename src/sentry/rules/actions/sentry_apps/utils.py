from __future__ import annotations

from typing import Any, Mapping, Sequence

from rest_framework import serializers

from sentry.constants import SENTRY_APP_ACTIONS
from sentry.services.hybrid_cloud.app import app_service


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
        # Bubble up errors from Sentry App to the UI
        if not result.success:
            raise serializers.ValidationError({"actions": [result.message]})
        created = "alert-rule-action"
    return created
