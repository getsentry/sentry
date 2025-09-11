from typing import Any

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


def handle_github_pr_webhook_for_autofix(
    org: Organization, action: str, pull_request: dict[str, Any], github_user: dict[str, Any]
) -> None:
    if (
        not hasattr(settings, "SEER_AUTOFIX_GITHUB_APP_USER_ID")
        or github_user["id"] != settings.SEER_AUTOFIX_GITHUB_APP_USER_ID
    ):
        return None

    if action not in ["opened", "closed"]:
        return None

    autofix_state = get_autofix_state_from_pr_id("integrations:github", pull_request["id"])
    if autofix_state:
        analytic_action = "opened" if action == "opened" else "closed"
        if pull_request["merged"]:
            analytic_action = "merged"

        event_cls: type[AiAutofixPrEvent] | None = None
        if analytic_action == "merged":
            event_cls = AiAutofixPrMergedEvent
        elif analytic_action == "closed":
            event_cls = AiAutofixPrClosedEvent
        elif analytic_action == "opened":
            event_cls = AiAutofixPrOpenedEvent
        if event_cls:
            analytics.record(
                event_cls(
                    organization_id=org.id,
                    integration=IntegrationProviderSlug.GITHUB.value,
                    project_id=autofix_state.request.project_id,
                    group_id=autofix_state.request.issue["id"],
                    run_id=autofix_state.run_id,
                )
            )

        metrics.incr(f"ai.autofix.pr.{analytic_action}")
