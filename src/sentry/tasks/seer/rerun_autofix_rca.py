from __future__ import annotations

import logging
from collections import Counter
from typing import Literal

from django.db import router, transaction
from taskbroker_client.state import current_task

from sentry import options
from sentry.models.group import Group
from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    NoSeerQuotaException,
    get_autofix_run_state,
    trigger_autofix_agent,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models import SeerAgentRun, SeerApiError, SeerPermissionError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import metrics

logger = logging.getLogger(__name__)

_TASK_KEY = "rerun_autofix_rca_batch"

RerunOutcome = Literal[
    "started",
    "missing_run",
    "no_quota",
    "failed",
]


@instrumented_task(
    name="sentry.tasks.seer.rerun_autofix_rca.rerun_autofix_rca_batch",
    namespace=seer_tasks,
    processing_deadline_duration=15 * 60,
)
def rerun_autofix_rca_batch(
    run_ids: list[int],
    offset: int = 0,
    **kwargs: object,
) -> None:
    """Re-run the RCA step for a reviewed list of affected Autofix runs.

    The input list is carried by the self-chained task. Each run provides the
    group and the configuration that can be safely reproduced.
    """
    task_state = current_task()
    activation_id = task_state.id if task_state else None
    if activation_id and already_spawned(_TASK_KEY, activation_id):
        logger.info(
            "autofix_rca_rerun.duplicate_redelivery.skipped",
            extra={"activation_id": activation_id},
        )
        metrics.incr("taskworker.selfchain.duplicate_skipped", tags={"task": _TASK_KEY})
        return

    if options.get("seer.autofix_rca_rerun.killswitch"):
        logger.info("autofix_rca_rerun.killswitch_enabled")
        return

    batch_size: int = options.get("seer.autofix_rca_rerun.batch_size")
    if batch_size <= 0:
        logger.error("autofix_rca_rerun.invalid_batch_size", extra={"batch_size": batch_size})
        return

    batch = run_ids[offset : offset + batch_size]
    if not batch:
        logger.info("autofix_rca_rerun.completed", extra={"run_count": len(run_ids)})
        return

    outcomes: Counter[RerunOutcome] = Counter()
    for run_id in batch:
        outcomes[rerun_autofix_rca_for_run(run_id)] += 1

    for outcome, count in outcomes.items():
        metrics.incr("autofix_rca_rerun.groups", amount=count, tags={"outcome": outcome})

    logger.info(
        "autofix_rca_rerun.batch_complete",
        extra={
            "offset": offset,
            "batch_size": len(batch),
            "outcomes": dict(outcomes),
        },
    )

    max_failures: int = options.get("seer.autofix_rca_rerun.max_failures_per_batch")
    if max_failures > 0 and outcomes["failed"] >= max_failures:
        logger.error(
            "autofix_rca_rerun.max_failures_reached",
            extra={"offset": offset, "failure_count": outcomes["failed"]},
        )
        return

    next_offset = offset + len(batch)
    if next_offset >= len(run_ids):
        logger.info("autofix_rca_rerun.completed", extra={"run_count": len(run_ids)})
        return

    inter_batch_delay_s: int = options.get("seer.autofix_rca_rerun.inter_batch_delay_s")
    rerun_autofix_rca_batch.apply_async(
        args=[run_ids],
        kwargs={"offset": next_offset},
        countdown=inter_batch_delay_s,
        headers={"sentry-propagate-traces": False},
    )
    if activation_id:
        mark_spawned(_TASK_KEY, activation_id)


def rerun_autofix_rca_for_run(run_id: int) -> RerunOutcome:
    """Start a new RCA run using configuration from a previous Autofix run."""
    using = router.db_for_write(Group)
    with transaction.atomic(using=using):
        source_agent_run = (
            SeerAgentRun.objects.select_related("run")
            .filter(run__seer_run_state_id=run_id, source="autofix")
            .first()
        )
        if source_agent_run is None or source_agent_run.group_id is None:
            logger.warning("autofix_rca_rerun.run_not_found", extra={"run_id": run_id})
            return "missing_run"
        source_run = source_agent_run.run

        group = (
            Group.objects.select_for_update()
            .select_related("project__organization")
            .filter(id=source_agent_run.group_id)
            .first()
        )
        if group is None:
            logger.warning("autofix_rca_rerun.group_not_found", extra={"run_id": run_id})
            return "missing_run"

        try:
            state = get_autofix_run_state(group, run_id)
            metadata = state.metadata or {}
            referrer = AutofixReferrer(
                metadata.get("referrer") or source_run.referrer or AutofixReferrer.WEB
            )
            raw_stopping_point = metadata.get("stopping_point")
            stopping_point = (
                AutofixStoppingPoint(raw_stopping_point) if raw_stopping_point is not None else None
            )
            trigger_autofix_agent(
                group=group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=referrer,
                stopping_point=stopping_point,
                skip_quota=True,
            )
        except NoSeerQuotaException:
            return "no_quota"
        except ValueError:
            logger.exception("autofix_rca_rerun.invalid_source_config", extra={"run_id": run_id})
            return "failed"
        except (SeerApiError, SeerPermissionError):
            logger.exception("autofix_rca_rerun.dispatch_failed", extra={"run_id": run_id})
            return "failed"
        except Exception:
            logger.exception("autofix_rca_rerun.unexpected_error", extra={"run_id": run_id})
            return "failed"

    logger.info("autofix_rca_rerun.started", extra={"run_id": run_id, "group_id": group.id})
    return "started"
