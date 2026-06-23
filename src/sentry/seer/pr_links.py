"""Link a Seer run to a pull request it opened."""

from __future__ import annotations

import logging

from sentry.models.organization import Organization
from sentry.pr_metrics.pull_requests import get_or_create_seer_pull_request
from sentry.seer.models.run import SeerRun, SeerRunPullRequest

logger = logging.getLogger(__name__)


def link_seer_run_to_pull_request(
    *,
    organization: Organization,
    seer_run_state_id: int,
    repo_name: str,
    provider: str | None,
    pr_number: int | str,
) -> SeerRunPullRequest | None:
    """Record a ``SeerRunPullRequest``, or None if the run or repo can't be resolved."""
    log_context = {
        "organization_id": organization.id,
        "seer_run_state_id": seer_run_state_id,
        "repo_name": repo_name,
        "provider": provider,
        "pr_number": pr_number,
    }

    seer_run = SeerRun.objects.filter(
        organization_id=organization.id, seer_run_state_id=seer_run_state_id
    ).first()
    if seer_run is None:
        logger.warning("seer.pr_link.run_not_found", extra=log_context)
        return None

    resolution = get_or_create_seer_pull_request(
        organization_id=organization.id,
        repo_name=repo_name,
        provider=provider,
        pr_number=pr_number,
    )
    if resolution.pull_request is None:
        logger.warning("seer.pr_link.repo_unresolved", extra=log_context)
        return None

    link, _ = SeerRunPullRequest.objects.get_or_create(
        seer_run=seer_run, pull_request=resolution.pull_request
    )
    logger.info(
        "seer.pr_link.recorded",
        extra={**log_context, "pull_request_id": resolution.pull_request.id},
    )
    return link
