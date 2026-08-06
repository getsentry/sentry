from __future__ import annotations

import logging
from collections import Counter
from datetime import timedelta

from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.milestones import (
    milestones_from_state,
    reconcile_milestones,
    record_pull_requests_merged,
)
from sentry.seer.models.run import SeerRun, SeerRunMilestoneType, SeerRunMirrorStatus
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = 25
MAX_BATCH_SIZE = 100
BACKFILL_WINDOW = timedelta(days=30)


def _all_linked_pull_requests_merged(seer_run: SeerRun) -> bool:
    states = list(seer_run.pull_requests.values_list("state", flat=True))
    return bool(states) and all(state == PullRequestLifecycleState.MERGED for state in states)


@instrumented_task(
    name="sentry.tasks.seer.backfill_run_milestones.backfill_run_milestones_for_org",
    namespace=seer_tasks,
    processing_deadline_duration=15 * 60,
    retry=Retry(times=3, delay=60, on=(Exception,)),
)
def backfill_run_milestones_for_org(
    organization_id: int,
    last_seer_run_id: int = 0,
    batch_size: int = DEFAULT_BATCH_SIZE,
    dry_run: bool = True,
) -> None:
    """Backfill one explicitly supplied organization over the preceding 30 days."""
    end_at = timezone.now()
    start_at = end_at - BACKFILL_WINDOW
    if batch_size < 1 or batch_size > MAX_BATCH_SIZE:
        raise ValueError(f"batch_size must be between 1 and {MAX_BATCH_SIZE}")

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
            agent__source="autofix",
            mirror_status=SeerRunMirrorStatus.LIVE,
            seer_run_state_id__isnull=False,
            last_triggered_at__gte=start_at,
            last_triggered_at__lt=end_at,
        ).order_by("id")[: batch_size + 1]
    )
    runs = candidates[:batch_size]
    has_more = len(candidates) > batch_size

    if not runs:
        logger.info(
            "seer.run_milestone_backfill.completed",
            extra={
                "organization_id": organization_id,
                "start": start_at.isoformat(),
                "end": end_at.isoformat(),
                "dry_run": dry_run,
                "last_seer_run_id": last_seer_run_id,
            },
        )
        return

    viewer_context = SeerViewerContext(organization_id=organization_id)
    milestone_counts: Counter[str] = Counter()
    missing_state_count = 0

    for seer_run in runs:
        if seer_run.seer_run_state_id is None:
            continue
        try:
            state = fetch_run_status(
                seer_run.seer_run_state_id,
                organization,
                viewer_context=viewer_context,
            )
        except SeerApiError as error:
            if error.status != 404:
                raise
            missing_state_count += 1
            logger.warning(
                "seer.run_milestone_backfill.state_not_found",
                extra={
                    "organization_id": organization_id,
                    "seer_run_id": seer_run.id,
                    "seer_run_state_id": seer_run.seer_run_state_id,
                },
            )
            continue
        except ValueError:
            missing_state_count += 1
            logger.warning(
                "seer.run_milestone_backfill.state_missing_session",
                extra={
                    "organization_id": organization_id,
                    "seer_run_id": seer_run.id,
                    "seer_run_state_id": seer_run.seer_run_state_id,
                },
            )
            continue

        derived = milestones_from_state(state)
        milestone_counts.update(derived.keys())
        if _all_linked_pull_requests_merged(seer_run):
            milestone_counts[SeerRunMilestoneType.PULL_REQUESTS_MERGED] += 1

        if not dry_run:
            reconcile_milestones(seer_run, state)
            record_pull_requests_merged(seer_run)

    metrics.incr(
        "seer.run_milestone_backfill.runs_processed",
        amount=len(runs),
        tags={"dry_run": str(dry_run).lower()},
    )
    metrics.incr(
        "seer.run_milestone_backfill.states_missing",
        amount=missing_state_count,
        tags={"dry_run": str(dry_run).lower()},
    )
    logger.info(
        "seer.run_milestone_backfill.batch_complete",
        extra={
            "organization_id": organization_id,
            "start": start_at.isoformat(),
            "end": end_at.isoformat(),
            "dry_run": dry_run,
            "runs_processed": len(runs),
            "states_missing": missing_state_count,
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
            },
            countdown=5,
            headers={"sentry-propagate-traces": False},
        )
