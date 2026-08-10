from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from django.utils import timezone
from pydantic import ValidationError
from taskbroker_client.retry import Retry

from sentry import options
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.milestones import (
    SEER_STATE_MILESTONES,
    all_linked_pull_requests_merged,
    milestones_from_state,
    milestones_to_delete,
    reconcile_milestones,
    reconcile_pull_requests_merged_milestone,
    record_has_pull_request,
)
from sentry.seer.models.run import (
    SeerRun,
    SeerRunMilestone,
    SeerRunMilestoneType,
    SeerRunMirrorStatus,
)
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

logger = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = 25
MAX_BATCH_SIZE = 25
BACKFILL_WINDOW = timedelta(days=30)


def milestones_that_would_delete(seer_run: SeerRun, state: SeerRunState) -> set[str]:
    desired = milestones_from_state(state).keys() & SEER_STATE_MILESTONES
    to_delete = milestones_to_delete(seer_run, desired)
    pr_merged_exists = SeerRunMilestone.objects.filter(
        seer_run=seer_run, milestone=SeerRunMilestoneType.PULL_REQUESTS_MERGED
    ).exists()
    if pr_merged_exists and not all_linked_pull_requests_merged(seer_run):
        to_delete.add(SeerRunMilestoneType.PULL_REQUESTS_MERGED)
    return to_delete


@instrumented_task(
    name="sentry.tasks.seer.backfill_run_milestones.backfill_run_milestones_for_org",
    namespace=seer_tasks,
    processing_deadline_duration=15 * 60,
    retry=Retry(times=3, delay=60, on=(Exception,), ignore=(ValueError,)),
)
def backfill_run_milestones_for_org(
    organization_id: int,
    last_seer_run_id: int = 0,
    batch_size: int = DEFAULT_BATCH_SIZE,
    dry_run: bool = True,
    start_at: str | None = None,
    end_at: str | None = None,
) -> None:
    """Backfill one explicitly supplied organization over the preceding 30 days."""
    if options.get("seer.run_milestone_backfill.killswitch"):
        logger.info("seer.run_milestone_backfill.killswitch_enabled")
        return

    if batch_size < 1 or batch_size > MAX_BATCH_SIZE:
        raise ValueError(f"batch_size must be between 1 and {MAX_BATCH_SIZE}")

    window_end = datetime.fromisoformat(end_at) if end_at else timezone.now()
    window_start = datetime.fromisoformat(start_at) if start_at else window_end - BACKFILL_WINDOW

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "seer.run_milestone_backfill.organization_not_found",
            extra={"organization_id": organization_id},
        )
        return

    candidates = list(
        SeerRun.objects.filter(
            id__gt=last_seer_run_id,
            organization_id=organization_id,
            agent__source__in=("autofix", "autofix_rca"),
            mirror_status=SeerRunMirrorStatus.LIVE,
            seer_run_state_id__isnull=False,
            last_triggered_at__gte=window_start,
            last_triggered_at__lt=window_end,
        ).order_by("id")[: batch_size + 1]
    )
    runs = candidates[:batch_size]
    has_more = len(candidates) > batch_size

    if not runs:
        logger.info(
            "seer.run_milestone_backfill.completed",
            extra={
                "organization_id": organization_id,
                "start": window_start.isoformat(),
                "end": window_end.isoformat(),
                "dry_run": dry_run,
                "last_seer_run_id": last_seer_run_id,
            },
        )
        return

    viewer_context = SeerViewerContext(organization_id=organization_id)
    milestone_counts: Counter[str] = Counter()
    missing_state_count = 0
    invalid_state_count = 0
    fetch_failed_count = 0
    processed_count = 0
    would_delete_count = 0

    for seer_run in runs:
        log_extra = {
            "organization_id": organization_id,
            "seer_run_id": seer_run.id,
            "seer_run_state_id": seer_run.seer_run_state_id,
        }
        try:
            state = fetch_run_status(
                seer_run.seer_run_state_id,
                organization,
                viewer_context=viewer_context,
            )
        except SeerApiError as error:
            if error.status == 404:
                missing_state_count += 1
                logger.warning("seer.run_milestone_backfill.state_not_found", extra=log_extra)
                continue
            fetch_failed_count += 1
            logger.warning(
                "seer.run_milestone_backfill.fetch_failed",
                exc_info=True,
                extra={**log_extra, "status": error.status},
            )
            continue
        except ValidationError:
            invalid_state_count += 1
            logger.warning(
                "seer.run_milestone_backfill.state_invalid", exc_info=True, extra=log_extra
            )
            continue
        except ValueError:
            missing_state_count += 1
            logger.warning("seer.run_milestone_backfill.state_missing_session", extra=log_extra)
            continue

        processed_count += 1
        derived = milestones_from_state(state)
        milestone_counts.update(derived.keys())
        has_linked_pr = seer_run.pull_requests.exists()
        if has_linked_pr and SeerRunMilestoneType.HAS_PULL_REQUEST not in derived:
            milestone_counts[SeerRunMilestoneType.HAS_PULL_REQUEST] += 1
        if all_linked_pull_requests_merged(seer_run):
            milestone_counts[SeerRunMilestoneType.PULL_REQUESTS_MERGED] += 1

        if dry_run:
            would_delete_count += len(milestones_that_would_delete(seer_run, state))
        else:
            reconcile_milestones(seer_run, state)
            if has_linked_pr:
                record_has_pull_request(seer_run)
            reconcile_pull_requests_merged_milestone(seer_run)

    if fetch_failed_count == len(runs):
        raise SeerApiError("Seer state fetch failed for the entire batch", 503)

    logger.info(
        "seer.run_milestone_backfill.batch_complete",
        extra={
            "organization_id": organization_id,
            "start": window_start.isoformat(),
            "end": window_end.isoformat(),
            "dry_run": dry_run,
            "runs_processed": processed_count,
            "would_delete": would_delete_count,
            "states_missing": missing_state_count,
            "states_invalid": invalid_state_count,
            "fetch_failed": fetch_failed_count,
            "milestone_counts": dict(milestone_counts),
            "last_seer_run_id": runs[-1].id,
            "has_more": has_more,
        },
    )

    if has_more:
        backfill_run_milestones_for_org.apply_async(
            args=[organization_id],
            kwargs={
                "last_seer_run_id": runs[-1].id,
                "batch_size": batch_size,
                "dry_run": dry_run,
                "start_at": window_start.isoformat(),
                "end_at": window_end.isoformat(),
            },
            countdown=5,
            headers={"sentry-propagate-traces": False},
        )
    else:
        logger.info(
            "seer.run_milestone_backfill.completed",
            extra={
                "organization_id": organization_id,
                "start": window_start.isoformat(),
                "end": window_end.isoformat(),
                "dry_run": dry_run,
                "last_seer_run_id": runs[-1].id,
            },
        )
