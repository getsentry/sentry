"""Records the pull requests Seer directly creates via :class:`SeerRunPullRequest`."""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry import features, options
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.pullrequest import PullRequest
from sentry.pr_metrics.attribution import attribute_seer_created_pull_requests
from sentry.seer.endpoints.utils import get_seer_run
from sentry.seer.models.run import SeerRun, SeerRunCodingAgentHandoff, SeerRunPullRequest
from sentry.seer.sentry_data_models import (
    NotifySeerPrCreatedErrorResponse,
    NotifySeerPrCreatedSuccessResponse,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def link_seer_run_pull_requests(
    *,
    organization: Organization,
    seer_run_state_id: int | None,
    pull_requests: Sequence[Mapping[str, Any]],
) -> None:
    """Link each PR in a ``seer.pr_created`` event to its run's :class:`SeerRun`.

    Idempotent (first run to claim a PR keeps it) and best-effort: every failure
    is logged and swallowed.
    """
    if options.get("seer.pull-request-linking.killswitch.enabled"):
        return

    if seer_run_state_id is None:
        return

    seer_run = get_seer_run(seer_run_state_id, organization)
    if seer_run is None:
        logger.info(
            "seer.pr_link.run_not_found",
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

        link_pull_request_to_seer_run(
            organization=organization,
            seer_run=seer_run,
            repo_name=repo_name,
            provider=provider,
            pr_number=pr_number,
            log_context=log_context,
        )


def link_pull_request_to_seer_run(
    *,
    organization: Organization,
    seer_run: SeerRun,
    repo_name: str | None,
    provider: str | None,
    pr_number: int | str | None,
    log_context: Mapping[str, Any],
    coding_agent_handoff: SeerRunCodingAgentHandoff | None = None,
) -> PullRequest | None:
    """Idempotently links one PR to ``seer_run``. Never raises -- returns None on
    failure. Pass ``coding_agent_handoff`` to record which handoff produced the PR.
    Checks the killswitch itself so every write path respects it.
    """
    if options.get("seer.pull-request-linking.killswitch.enabled"):
        return None

    if not repo_name or pr_number is None:
        logger.warning("seer.pr_link.missing_fields", extra=log_context)
        return None

    try:
        resolved = PullRequest.objects.get_or_create_from_reference(
            organization_id=organization.id,
            repo_name=repo_name,
            provider=provider,
            key=pr_number,
        )
    except Exception:
        logger.exception("seer.pr_link.resolve_failed", extra=log_context)
        return None

    if resolved.pull_request is None:
        logger.warning("seer.pr_link.repo_unresolved", extra=log_context)
        return None

    try:
        _, created = SeerRunPullRequest.objects.get_or_create(
            pull_request=resolved.pull_request,
            defaults={"seer_run": seer_run, "coding_agent_handoff": coding_agent_handoff},
        )
    except Exception:
        logger.exception(
            "seer.pr_link.write_failed",
            extra={**log_context, "pull_request_id": resolved.pull_request.id},
        )
        return None

    if created:
        logger.info(
            "seer.pr_link.created",
            extra={**log_context, "pull_request_id": resolved.pull_request.id},
        )

    return resolved.pull_request


def record_seer_created_pull_requests(
    *,
    organization: Organization,
    run_id: int | None,
    pull_requests: Sequence[Mapping[str, Any]],
    group_id: int | None = None,
) -> None:
    """Record attribution + a run link for the PRs Seer directly created.

    Attribution is gated on ``organizations:pr-metrics-attribution``; linking is
    gated only on its own killswitch (checked inside ``link_seer_run_pull_requests``)
    and always attempted. Both sides are best-effort: any failure is logged and
    swallowed so the caller's flow is never interrupted.
    """
    log_context = {
        "organization_id": organization.id,
        "run_id": run_id,
        "group_id": group_id,
    }

    if features.has("organizations:pr-metrics-attribution", organization):
        try:
            attribute_seer_created_pull_requests(
                organization=organization,
                pull_requests=pull_requests,
                run_id=run_id,
                group_id=group_id,
            )
        except Exception:
            logger.exception("seer.pr_attribution.failed", extra=log_context)

    try:
        link_seer_run_pull_requests(
            organization=organization,
            seer_run_state_id=run_id,
            pull_requests=pull_requests,
        )
    except Exception:
        logger.exception("seer.pr_link.failed", extra=log_context)


def notify_seer_pr_created(
    *,
    organization_id: int,
    run_id: int,
    pull_requests: list[dict[str, Any]],
    group_id: int | None = None,
) -> NotifySeerPrCreatedSuccessResponse | NotifySeerPrCreatedErrorResponse:
    """Record attribution + run link for a PR Seer just created (Seer -> Sentry RPC).

    Run-anchored and issue-optional: Seer's PR writer calls this for every PR it
    opens, whether or not the run is tied to an issue (``group_id`` may be None).
    This is deliberately independent of the autofix completion hook -- it does no
    sentry-app broadcast, Activity creation, or analytics, and is not gated on
    ``SeerAutofixOperator.has_access``. Attribution and linking keep their own
    existing gates (the ``organizations:pr-metrics-attribution`` flag and the
    ``seer.pull-request-linking.killswitch.enabled`` killswitch respectively),
    inherited via ``record_seer_created_pull_requests``.
    """
    try:
        organization = Organization.objects.get(
            id=organization_id, status=OrganizationStatus.ACTIVE
        )
    except Organization.DoesNotExist:
        # An org deleted or suspended mid-run is a normal race, not a fault: warn
        # (no Sentry event) and let the counter carry the rate.
        logger.warning(
            "seer.pr_created_notify.organization_not_found_or_not_active",
            extra={"organization_id": organization_id},
        )
        metrics.incr("seer.pr_created_notify.skipped", tags={"reason": "org_gone"})
        return NotifySeerPrCreatedErrorResponse(error="Organization not found or not active")

    metrics.incr("seer.pr_created_notify", tags={"has_group": group_id is not None})

    record_seer_created_pull_requests(
        organization=organization,
        run_id=run_id,
        pull_requests=pull_requests,
        group_id=group_id,
    )

    return NotifySeerPrCreatedSuccessResponse()
