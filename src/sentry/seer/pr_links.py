"""Link a Seer run to the pull requests it opened."""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry import options
from sentry.models.organization import Organization
from sentry.pr_metrics.pull_requests import get_or_create_seer_pull_request
from sentry.seer.models.run import SeerRun, SeerRunPullRequest

logger = logging.getLogger(__name__)


def maybe_link_seer_run_to_pull_requests(
    *,
    organization: Organization,
    pull_requests: Sequence[Mapping[str, Any]],
    run_id: int,
) -> None:
    """Killswitch-gated, never-throwing entry point for run→PR linking.

    Callers can fire-and-forget this; the killswitch short-circuits it and any
    failure is logged rather than propagated.
    """
    if options.get("seer.run-pr-link.killswitch.enabled"):
        return
    try:
        link_seer_run_to_pull_requests(
            organization=organization, pull_requests=pull_requests, run_id=run_id
        )
    except Exception:
        logger.exception(
            "seer.pr_link.failed",
            extra={"organization_id": organization.id, "seer_run_state_id": run_id},
        )


def link_seer_run_to_pull_requests(
    *,
    organization: Organization,
    pull_requests: Sequence[Mapping[str, Any]],
    run_id: int,
) -> None:
    """Record a ``SeerRunPullRequest`` for each PR a Seer run reported opening.

    ``pull_requests`` is the ``seer.pr_created`` payload (same shape attribution
    consumes); ``run_id`` is Seer's ``DbRunState.id``. Best-effort per entry.
    """
    seer_run = SeerRun.objects.filter(
        organization_id=organization.id, seer_run_state_id=run_id
    ).first()
    if seer_run is None:
        logger.warning(
            "seer.pr_link.run_not_found",
            extra={"organization_id": organization.id, "seer_run_state_id": run_id},
        )
        return

    for entry in pull_requests:
        repo_name = entry.get("repo_name")
        provider = entry.get("provider")
        pr_payload = entry.get("pull_request") or {}
        pr_number = pr_payload.get("pr_number")

        log_context = {
            "organization_id": organization.id,
            "seer_run_state_id": run_id,
            "repo_name": repo_name,
            "provider": provider,
            "pr_number": pr_number,
        }

        if not repo_name or pr_number is None:
            logger.warning("seer.pr_link.missing_fields", extra=log_context)
            continue

        resolution = get_or_create_seer_pull_request(
            organization_id=organization.id,
            repo_name=repo_name,
            provider=provider,
            pr_number=pr_number,
        )
        if resolution.pull_request is None:
            logger.warning("seer.pr_link.repo_unresolved", extra=log_context)
            continue

        SeerRunPullRequest.objects.get_or_create(
            seer_run=seer_run, pull_request=resolution.pull_request
        )
        logger.info(
            "seer.pr_link.recorded",
            extra={**log_context, "pull_request_id": resolution.pull_request.id},
        )
