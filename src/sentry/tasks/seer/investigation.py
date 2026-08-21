from __future__ import annotations

import logging

from sentry.investigations.agent import start_execution_run
from sentry.investigations.models import (
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
)
from sentry.investigations.services import mark_block_execution_dispatch_failed
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
        .filter(id=execution_id, status=InvestigationBlockExecutionStatus.PENDING)
        .first()
    )
    if execution is None:
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
        )
    except Exception:
        logger.exception("investigations.execution.dispatch_failed")
        mark_block_execution_dispatch_failed(execution)
