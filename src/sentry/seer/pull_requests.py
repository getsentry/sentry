"""Product-facing record of the pull requests Seer directly creates.

This module owns the write side of :class:`SeerRunPullRequest` — the link
between a Seer run and the pull request(s) it opened. Its purpose is to give us
a durable, product-focused record of Seer's PR output that can be queried
straight from the ORM (``seer_run.pull_requests``).

It is intentionally kept separate from the PR Merge Live Metrics pipeline
(``sentry.pr_metrics``): metrics judges PR *outcomes* (was it merged, did it get
iterated on), while this records PR *authorship* (which run opened it). They
share only the PR-resolution query (``PullRequest.objects.get_or_create_from_reference``)
and the run lookup (``get_seer_run``) — never each other's logic, flags, or
failure modes.

Writes are best-effort and guarded by a killswitch so they can be turned off
without a deploy if anything goes wrong.
"""

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

# Killswitch for SeerRunPullRequest writes. Follows the Seer killswitch
# convention: default off (``False`` -> writes happen); flip to ``True`` to stop
# all writes without a deploy.
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

    # The run id in the event equals SeerRun.seer_run_state_id; the mirror row may
    # still be absent if its create outbox hasn't drained yet, or for legacy runs
    # predating SeerRun mirroring. Either way there is nothing to link to.
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
            # Repo couldn't be uniquely resolved (not found / ambiguous). The
            # metrics path logs the precise reason under its own namespace; here
            # we only need to know we couldn't link.
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
