from typing import Any, Literal

import sentry_sdk
from django.conf import settings

from sentry import analytics
from sentry.analytics.events.ai_autofix_pr_events import (
    AiAutofixPrClosedEvent,
    AiAutofixPrEvent,
    AiAutofixPrMergedEvent,
    AiAutofixPrOpenedEvent,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.seer.autofix.utils import get_autofix_state_from_pr_id
from sentry.utils import metrics

AnalyticAction = Literal["opened", "closed", "merged"]

ACTION_TO_EVENTS: dict[AnalyticAction, type[AiAutofixPrEvent]] = {
    "merged": AiAutofixPrMergedEvent,
    "closed": AiAutofixPrClosedEvent,
    "opened": AiAutofixPrOpenedEvent,
}


def handle_github_pr_webhook_for_autofix(
    org: Organization, action: str, pull_request: dict[str, Any], github_user: dict[str, Any]
) -> None:
    allowed_user_ids = set()
    if (
        hasattr(settings, "SEER_AUTOFIX_GITHUB_APP_USER_ID")
        and settings.SEER_AUTOFIX_GITHUB_APP_USER_ID
    ):
        allowed_user_ids.add(settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)
    if hasattr(settings, "SENTRY_GITHUB_APP_USER_ID") and settings.SENTRY_GITHUB_APP_USER_ID:
        allowed_user_ids.add(settings.SENTRY_GITHUB_APP_USER_ID)
    if github_user["id"] not in allowed_user_ids:
        return None

    if action not in ["opened", "closed"]:
        return None

    autofix_state = get_autofix_state_from_pr_id("integrations:github", pull_request["id"])
    if autofix_state:
        analytic_action: AnalyticAction = "opened" if action == "opened" else "closed"
        if pull_request["merged"]:
            analytic_action = "merged"

        try:
            analytics.record(
                ACTION_TO_EVENTS[analytic_action](
                    organization_id=org.id,
                    integration=IntegrationProviderSlug.GITHUB.value,
                    project_id=autofix_state.request.project_id,
                    group_id=autofix_state.request.issue["id"],
                    run_id=autofix_state.run_id,
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)

        metrics.incr(f"ai.autofix.pr.{analytic_action}")
