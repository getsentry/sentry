"""Records the pull requests Seer directly creates via :class:`SeerRunPullRequest`."""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry import options
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.seer.endpoints.utils import get_seer_run
from sentry.seer.models.run import SeerRunPullRequest

logger = logging.getLogger(__name__)

PULL_REQUEST_LINKING_KILLSWITCH = "seer.pull-request-linking.killswitch.enabled"


def link_seer_run_pull_requests(
    *,
    organization: Organization,
    seer_run_state_id: int | str | None,
    pull_requests: Sequence[Mapping[str, Any]],
) -> None:
    """Record a :class:`SeerRunPullRequest` link for each PR Seer reports it opened.

    ``pull_requests`` is the ``seer.pr_created`` event's PR list (the same shape
    consumed by ``attribute_seer_created_pull_requests``). Each entry is resolved
    to its canonical ``PullRequest`` via the shared
    ``get_or_create_from_reference`` query, then linked to the run's
    :class:`SeerRun` mirror.

    Idempotent: the unique constraint on ``pull_request`` means redelivery is a
    no-op and the first run to claim a PR keeps it. Best-effort — every failure
    (a not-yet-mirrored run, an unresolvable repo, a single bad entry) is logged
    and swallowed so it never interrupts the caller's flow.
    """
    if options.get(PULL_REQUEST_LINKING_KILLSWITCH):
        return

    if seer_run_state_id is None:
        return

    try:
        seer_run_state_id = int(seer_run_state_id)
    except (TypeError, ValueError):
        logger.warning(
            "seer.pull_request_link.invalid_run_id",
            extra={"organization_id": organization.id, "seer_run_state_id": seer_run_state_id},
        )
        return

    # The mirror row may not exist yet (create outbox not drained) or for legacy
    # runs predating SeerRun mirroring — nothing to link to in either case.
    seer_run = get_seer_run(seer_run_state_id, organization)
    if seer_run is None:
        logger.info(
            "seer.pull_request_link.run_not_found",
            extra={"organization_id": organization.id, "seer_run_state_id": seer_run_state_id},
        )
        return

    for entry in pull_requests:
        repo_name = entry.get("repo_name")
        provider = entry.get("provider")
        pr_payload = entry.get("pull_request") or {}
        pr_number = pr_payload.get("pr_number")

        log_context = {
            "organization_id": organization.id,
            "seer_run_state_id": seer_run_state_id,
            "repo_name": repo_name,
            "provider": provider,
            "pr_number": pr_number,
        }

        if not repo_name or pr_number is None:
            logger.warning("seer.pull_request_link.missing_fields", extra=log_context)
            continue

        try:
            resolved = PullRequest.objects.get_or_create_from_reference(
                organization_id=organization.id,
                repo_name=repo_name,
                provider=provider,
                key=pr_number,
            )
        except Exception:
            logger.exception("seer.pull_request_link.resolve_failed", extra=log_context)
            continue

        if resolved.pull_request is None:
            logger.warning("seer.pull_request_link.repo_unresolved", extra=log_context)
            continue

        try:
            _, created = SeerRunPullRequest.objects.get_or_create(
                pull_request=resolved.pull_request,
                defaults={"seer_run": seer_run},
            )
        except Exception:
            logger.exception(
                "seer.pull_request_link.write_failed",
                extra={**log_context, "pull_request_id": resolved.pull_request.id},
            )
            continue

        if created:
            logger.info(
                "seer.pull_request_link.created",
                extra={**log_context, "pull_request_id": resolved.pull_request.id},
            )
