import logging
from datetime import datetime
from typing import Any, Literal

import sentry_sdk
from django.conf import settings

from sentry import analytics, features
from sentry.analytics.events.ai_autofix_pr_events import (
    AiAutofixPrClosedEvent,
    AiAutofixPrEvent,
    AiAutofixPrMergedEvent,
    AiAutofixPrOpenedEvent,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.pr_metrics.attribution import SentryAppSignalDetails, record_attribution_signal
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.utils import metrics

logger = logging.getLogger("sentry.webhooks")

AnalyticAction = Literal["opened", "closed", "merged"]

ACTION_TO_EVENTS: dict[AnalyticAction, type[AiAutofixPrEvent]] = {
    "merged": AiAutofixPrMergedEvent,
    "closed": AiAutofixPrClosedEvent,
    "opened": AiAutofixPrOpenedEvent,
}

ACTION_TO_TIMESTAMP_FIELD: dict[AnalyticAction, str] = {
    "opened": "created_at",
    "merged": "merged_at",
    "closed": "closed_at",
}


def handle_github_pr_webhook_for_autofix(
    org: Organization,
    action: str,
    pull_request: dict[str, Any],
    github_user: dict[str, Any],
    repo_id: int,
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
        record_pr_action_analytic(org, action, pull_request, github_app, repo_id)
    except Exception as e:
        sentry_sdk.capture_exception(e)


def record_pr_action_analytic(
    org: Organization, action: str, pull_request: dict[str, Any], github_app: str, repo_id: int
) -> None:
    analytic_action: AnalyticAction = "opened" if action == "opened" else "closed"
    if pull_request["merged"]:
        analytic_action = "merged"

    sent_at = _get_pr_timestamp_ms(pull_request, analytic_action)

    agent_state = get_agent_state_from_pr_id(org.id, "integrations:github", pull_request["id"])
    if agent_state:
        group_id = agent_state.metadata.get("group_id") if agent_state.metadata else None
        if group_id is None:
            raise ValueError(f"Missing group id in agent run {agent_state.run_id}")
        group = Group.objects.get(id=group_id, project__organization_id=org.id)

        analytics.record(
            ACTION_TO_EVENTS[analytic_action](
                organization_id=org.id,
                integration=IntegrationProviderSlug.GITHUB.value,
                project_id=group.project.id,
                group_id=group.id,
                run_id=agent_state.run_id,
                github_app=github_app,
                sent_at=sent_at,
                referrer=agent_state.metadata.get("referrer") if agent_state.metadata else None,
            )
        )

        metrics.incr(f"ai.autofix.pr.{analytic_action}", tags={"mode": "explorer"})

        try:
            _record_pr_attribution(
                org=org,
                repo_id=repo_id,
                pull_request=pull_request,
                group_id=group.id,
                run_id=agent_state.run_id,
            )
        except Exception:
            logger.exception(
                "seer.autofix.pr_attribution.failed",
                extra={
                    "organization_id": org.id,
                    "group_id": group.id,
                    "run_id": agent_state.run_id,
                },
            )

        return


def _record_pr_attribution(
    *,
    org: Organization,
    repo_id: int,
    pull_request: dict[str, Any],
    group_id: int,
    run_id: int,
) -> None:
    """Write a SEER_DATA attribution signal from the same live Seer lookup that
    powers the ai.autofix.pr.opened/closed/merged analytics, so a PR is attributed
    as soon as any of those events fire — a backstop for (and independent of) the
    ``seer.pr_created`` callback that normally attributes it, which can race the
    GitHub webhook or be missed entirely.

    Shares the ``SEER_DATA``/``SENTRY_APP`` row with
    ``attribute_seer_created_pull_requests``; ``record_attribution_signal`` merges
    the two writes rather than one clobbering the other.
    """
    if not features.has("organizations:pr-metrics-attribution", org):
        return

    number = pull_request.get("number")
    if number is None:
        return

    pr, _ = PullRequest.objects.get_or_create(
        organization_id=org.id,
        repository_id=repo_id,
        key=str(number),
    )

    record_attribution_signal(
        pull_request=pr,
        signal_type=PullRequestAttributionSignalType.SENTRY_APP,
        source=PullRequestAttributionSource.SEER_DATA,
        signal_details=SentryAppSignalDetails(
            pr_url=pull_request.get("html_url") or "",
            group_ids=[group_id],
            run_id=run_id,
        ).dict(),
    )


def _get_pr_timestamp_ms(pull_request: dict[str, Any], action: AnalyticAction) -> int:
    ts_field = ACTION_TO_TIMESTAMP_FIELD[action]
    ts_value = pull_request.get(ts_field)
    if ts_value:
        return int(datetime.fromisoformat(ts_value).timestamp() * 1000)
    return int(datetime.fromisoformat(pull_request["updated_at"]).timestamp() * 1000)
