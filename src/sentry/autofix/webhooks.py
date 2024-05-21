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
) -> None:
    if github_user["id"] != AUTOFIX_GITHUB_APP_USER_ID:
        return

    if action in ["opened", "closed"]:
        autofix_state = get_autofix_state_from_pr_id("integrations:github", pull_request["id"])
        if autofix_state:
            analytic_action = "opened" if action == "opened" else "closed"
            if pull_request["merged"]:
                analytic_action = "merged"
            analytics.record(
                f"ai.autofix.pr.{analytic_action}",
                organization_id=org.id,
                integration="github",
                **get_webhook_analytics_fields(autofix_state),
            )
            metrics.incr(f"ai.autofix.pr.{analytic_action}")
