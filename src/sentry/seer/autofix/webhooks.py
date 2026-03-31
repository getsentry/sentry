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
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.autofix.utils import get_autofix_state_from_pr_id
from sentry.seer.explorer.client_utils import get_explorer_state_from_pr_id
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
    seer_app_id = getattr(settings, "SEER_AUTOFIX_GITHUB_APP_USER_ID", None)
    sentry_app_id = getattr(settings, "SENTRY_GITHUB_APP_USER_ID", None)

    allowed_user_ids = set()
    if seer_app_id:
        allowed_user_ids.add(seer_app_id)
    if sentry_app_id:
        allowed_user_ids.add(sentry_app_id)
    if github_user["id"] not in allowed_user_ids:
        return None

    github_app = "seer" if github_user["id"] == seer_app_id else "sentry"

    if action not in ["opened", "closed"]:
        return None

    try:
        record_pr_action_analytic(org, action, pull_request, github_app)
    except Exception as e:
        sentry_sdk.capture_exception(e)


def record_pr_action_analytic(
    org: Organization, action: str, pull_request: dict[str, Any], github_app: str
) -> None:
    analytic_action: AnalyticAction = "opened" if action == "opened" else "closed"
    if pull_request["merged"]:
        analytic_action = "merged"

    autofix_state = get_autofix_state_from_pr_id("integrations:github", pull_request["id"])
    if autofix_state:
        analytics.record(
            ACTION_TO_EVENTS[analytic_action](
                organization_id=org.id,
                integration=IntegrationProviderSlug.GITHUB.value,
                project_id=autofix_state.request.project_id,
                group_id=autofix_state.request.issue["id"],
                run_id=autofix_state.run_id,
                github_app=github_app,
            )
        )

        metrics.incr(f"ai.autofix.pr.{analytic_action}")
        return

    explorer_state = get_explorer_state_from_pr_id(
        org.id, "integrations:github", pull_request["id"]
    )
    if explorer_state:
        group_id = explorer_state.metadata.get("group_id") if explorer_state.metadata else None
        if group_id is None:
            raise ValueError(f"Missing group id in explorer run {explorer_state.run_id}")
        group = Group.objects.get(id=group_id, project__organization_id=org.id)

        analytics.record(
            ACTION_TO_EVENTS[analytic_action](
                organization_id=org.id,
                integration=IntegrationProviderSlug.GITHUB.value,
                project_id=group.project.id,
                group_id=group.id,
                run_id=explorer_state.run_id,
                github_app=github_app,
                referrer=explorer_state.metadata.get("referrer")
                if explorer_state.metadata
                else None,
            )
        )

        metrics.incr(f"ai.autofix.pr.{analytic_action}", tags={"mode": "explorer"})
        return
