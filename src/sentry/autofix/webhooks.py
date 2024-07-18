from typing import Any

from django.conf import settings

from sentry import analytics
from sentry.autofix.utils import AutofixState, get_autofix_state_from_pr_id
from sentry.models.organization import Organization
from sentry.utils import metrics


def get_webhook_analytics_fields(autofix_state: AutofixState) -> dict[str, Any]:
    webhook_analytics_fields = {}

    autofix_request = autofix_state.request

    webhook_analytics_fields["project_id"] = autofix_request.get("project_id", None)

    issue = autofix_request.get("issue", None)
    webhook_analytics_fields["group_id"] = issue.get("id", None) if issue else None

    webhook_analytics_fields["run_id"] = autofix_state.run_id

    return webhook_analytics_fields


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
        analytics.record(
            f"ai.autofix.pr.{analytic_action}",
            organization_id=org.id,
            integration="github",
            **get_webhook_analytics_fields(autofix_state),
        )
        metrics.incr(f"ai.autofix.pr.{analytic_action}")
