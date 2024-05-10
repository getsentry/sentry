from typing import Any

from sentry import analytics
from sentry.autofix.utils import get_autofix_state_from_pr_id
from sentry.models.organization import Organization
from sentry.utils import metrics

AUTOFIX_GITHUB_APP_USER_ID = 157164994


def get_webhook_analytics_fields(autofix_state: dict[str, Any]) -> dict[str, Any]:
    autofix_request = autofix_state.get("request", {})
    return {
        "project_id": autofix_request.get("project_id"),
        "group_id": autofix_request.get("issue", {}).get("id"),
        "run_id": autofix_state.get("run_id"),
    }


def handle_github_pr_webhook_for_autofix(
    org: Organization, action: str, pull_request: dict, github_user: dict
):
    if github_user["id"] == AUTOFIX_GITHUB_APP_USER_ID:
        if action == "opened":
            autofix_state = get_autofix_state_from_pr_id("integrations:github", pull_request["id"])
            if autofix_state:
                analytics.record(
                    "ai.autofix.pr.opened",
                    organization_id=org.id,
                    integration="github",
                    **get_webhook_analytics_fields(autofix_state),
                )
                metrics.incr("ai.autofix.pr.opened")
        if action == "closed":
            autofix_state = get_autofix_state_from_pr_id("integrations:github", pull_request["id"])
            if autofix_state:
                if pull_request["merged"]:
                    # PR Merged
                    analytics.record(
                        "ai.autofix.pr.merged",
                        organization_id=org.id,
                        integration="github",
                        **get_webhook_analytics_fields(autofix_state),
                    )
                    metrics.incr("ai.autofix.pr.merged")

                elif pull_request["merged"] is False:
                    # PR Closed
                    analytics.record(
                        "ai.autofix.pr.closed",
                        organization_id=org.id,
                        integration="github",
                        **get_webhook_analytics_fields(autofix_state),
                    )
                    metrics.incr("ai.autofix.pr.closed")
