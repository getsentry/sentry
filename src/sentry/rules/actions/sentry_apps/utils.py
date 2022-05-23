from __future__ import annotations

from typing import Mapping, Sequence

from rest_framework import serializers

from sentry.constants import SENTRY_APP_ACTIONS
from sentry.mediators import alert_rule_actions
from sentry.mediators.external_requests.alert_rule_action_requester import AlertRuleActionResult
from sentry.models import SentryAppInstallation


def trigger_sentry_app_action_creators_for_issues(
    actions: Sequence[Mapping[str, str]]
) -> str | None:
    created = None
    for action in actions:
        # Only call creator for Sentry Apps with UI Components for alert rules.
        if not action.get("id") in SENTRY_APP_ACTIONS:
            continue

        install = SentryAppInstallation.objects.get(uuid=action.get("sentryAppInstallationUuid"))
        result: AlertRuleActionResult = alert_rule_actions.AlertRuleActionCreator.run(
            install=install,
            fields=action.get("settings"),
        )
        # Bubble up errors from Sentry App to the UI
        if not result["success"]:
            raise serializers.ValidationError({"actions": [result["message"]]})
        created = "alert-rule-action"
    return created
