from __future__ import annotations

import logging
from uuid import UUID

from sentry.investigations.agent import start_execution_run
from sentry.investigations.models import (
    InvestigationCellExecution,
    InvestigationCellExecutionStatus,
)
from sentry.investigations.services import mark_cell_execution_dispatch_failed
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.models.user import User

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.seer.investigation.dispatch_investigation_execution",
    namespace=seer_tasks,
)
def dispatch_investigation_execution(execution_uuid: str) -> None:
    try:
        parsed_uuid = UUID(execution_uuid)
    except ValueError:
        logger.warning("investigations.execution.invalid_uuid")
        return
    execution = (
        InvestigationCellExecution.objects.select_related("cell__investigation__organization")
        .filter(uuid=parsed_uuid, status=InvestigationCellExecutionStatus.PENDING)
        .first()
    )
    if execution is None:
        return
    user = User.objects.filter(id=execution.triggered_by_id).first()
    try:
        start_execution_run(
            execution,
            execution.cell.investigation.organization,
            user,
        )
    except Exception as error:
        logger.exception("investigations.execution.dispatch_failed")
        mark_cell_execution_dispatch_failed(execution, error=str(error))
