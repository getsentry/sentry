from __future__ import annotations

import logging

from sentry.investigations.agent import (
    cancel_investigation_executions_after_failure,
    start_execution_run,
)
from sentry.investigations.models import InvestigationBlockExecution
from sentry.investigations.services import (
    mark_block_execution_dispatch_failed,
    mark_block_execution_dispatch_started,
)
from sentry.investigations.telemetry import record_execution_failed
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.seer.investigation.dispatch_investigation_execution",
    namespace=seer_tasks,
)
def dispatch_investigation_execution(execution_id: int) -> None:
    execution = (
        InvestigationBlockExecution.objects.select_related("block__investigation__organization")
        .filter(id=execution_id)
        .first()
    )
    if execution is None:
        return
    dispatch_claimed_at = mark_block_execution_dispatch_started(execution)
    if dispatch_claimed_at is None:
        return
    user = (
        user_service.get_user(user_id=execution.triggered_by_id)
        if execution.triggered_by_id is not None
        else None
    )
    try:
        start_execution_run(
            execution,
            execution.block.investigation.organization,
            user,
            dispatch_claimed_at=dispatch_claimed_at,
        )
    except Exception:
        logger.exception("investigations.execution.dispatch_failed")
        if mark_block_execution_dispatch_failed(execution, dispatch_claimed_at=dispatch_claimed_at):
            execution.refresh_from_db(fields=["completed_at"])
            record_execution_failed(execution, reason="dispatch_failed", seer_run_id=None)
            cancel_investigation_executions_after_failure(execution)
