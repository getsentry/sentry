from __future__ import annotations

import logging
from copy import deepcopy
from typing import Any

from django.db import router, transaction
from django.utils import timezone
from rest_framework import serializers
from taskbroker_client.retry import Retry
from taskbroker_client.state import current_task
from urllib3.exceptions import HTTPError

from sentry.investigations.agent import (
    cancel_investigation_executions_after_failure,
    start_execution_run,
)
from sentry.investigations.models import (
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.investigations.seer_client import (
    create_investigation_orchestration_run,
    dispatch_investigation_orchestration_command,
)
from sentry.investigations.services import (
    mark_block_execution_dispatch_failed,
    mark_block_execution_dispatch_started,
)
from sentry.investigations.services.orchestration_events import (
    synchronize_orchestration_projection,
)
from sentry.investigations.telemetry import record_execution_failed
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)

ORCHESTRATION_DISPATCH_RETRIES = 3
CREATE_DISPATCH_ERROR_MESSAGE = "Unable to start this investigation. Try again."
COMMAND_DISPATCH_ERROR_MESSAGE = "Unable to deliver this investigation command. Try again."


def _is_last_dispatch_attempt() -> bool:
    task_state = current_task()
    return task_state is not None and task_state.attempt >= ORCHESTRATION_DISPATCH_RETRIES


def _response_projection(response: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    run_id = response.get("runId")
    projection = response.get("projection")
    if isinstance(run_id, bool) or not isinstance(run_id, int) or not isinstance(projection, dict):
        raise SeerApiError("Seer returned an invalid investigation response", 502)
    return run_id, projection


def _mark_create_dispatch_failed(run_id: int, _error: BaseException) -> None:
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = InvestigationOrchestrationRun.objects.select_for_update().filter(id=run_id).first()
        if run is None or run.seer_run_id is not None:
            return
        detail = {
            "code": "seer_dispatch_failed",
            "message": CREATE_DISPATCH_ERROR_MESSAGE,
            "retryable": True,
        }
        run.phase = InvestigationOrchestrationPhase.FAILED
        run.status = InvestigationOrchestrationStatus.FAILED
        run.error = detail
        projection = deepcopy(run.projection)
        projection.update({"phase": run.phase, "status": run.status})
        errors = projection.setdefault("errors", [])
        if isinstance(errors, list):
            errors.append(detail)
        run.projection = projection
        run.save(update_fields=["phase", "status", "error", "projection", "date_updated"])


def _mark_command_dispatch_failed(command_id: int, _error: BaseException) -> None:
    database = router.db_for_write(InvestigationOrchestrationCommand)
    with transaction.atomic(using=database):
        command_snapshot = InvestigationOrchestrationCommand.objects.filter(id=command_id).first()
        if command_snapshot is None:
            return
        run = InvestigationOrchestrationRun.objects.select_for_update().get(
            id=command_snapshot.orchestration_run_id
        )
        command = (
            InvestigationOrchestrationCommand.objects.select_for_update()
            .filter(id=command_id)
            .first()
        )
        if (
            command is None
            or command.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        ):
            return
        detail = {
            "code": "seer_command_dispatch_failed",
            "message": COMMAND_DISPATCH_ERROR_MESSAGE,
            "requestId": str(command.request_id),
            "commandType": command.type,
            "retryable": True,
        }
        command.status = InvestigationOrchestrationCommandStatus.FAILED
        command.error = detail
        command.save(update_fields=["status", "error", "date_updated"])
        InvestigationOrchestrationCommand.objects.filter(
            orchestration_run=run,
            id__gt=command.id,
            status__in=(
                InvestigationOrchestrationCommandStatus.ACCEPTED,
                InvestigationOrchestrationCommandStatus.DISPATCHED,
            ),
        ).update(
            status=InvestigationOrchestrationCommandStatus.FAILED,
            error={
                "code": "earlier_command_failed",
                "message": "An earlier workflow command could not be delivered.",
            },
            date_updated=timezone.now(),
        )
        projection = deepcopy(run.projection)
        errors = projection.setdefault("errors", [])
        if isinstance(errors, list):
            errors.append(detail)
        run.error = detail
        run.projection = projection
        run.save(update_fields=["error", "projection", "date_updated"])


def _mark_command_dispatch_acknowledged(
    orchestration_run_id: int,
    command_id: int,
) -> None:
    database = router.db_for_write(InvestigationOrchestrationCommand)
    with transaction.atomic(using=database):
        run = InvestigationOrchestrationRun.objects.select_for_update().get(id=orchestration_run_id)
        command = InvestigationOrchestrationCommand.objects.select_for_update().get(id=command_id)
        command.status = InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        command.error = None
        command.save(update_fields=["status", "error", "date_updated"])
        projection = deepcopy(run.projection)
        errors = projection.get("errors")
        if isinstance(errors, list):
            projection["errors"] = [
                item
                for item in errors
                if not (
                    isinstance(item, dict)
                    and item.get("code") == "seer_command_dispatch_failed"
                    and item.get("requestId") == str(command.request_id)
                )
            ]
        if (
            isinstance(run.error, dict)
            and run.error.get("code") == "seer_command_dispatch_failed"
            and run.error.get("requestId") == str(command.request_id)
        ):
            run.error = None
        run.projection = projection
        run.save(update_fields=["error", "projection", "date_updated"])


@instrumented_task(
    name="sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create",
    namespace=seer_tasks,
    retry=Retry(
        times=ORCHESTRATION_DISPATCH_RETRIES,
        delay=2,
        on=(SeerApiError, HTTPError),
    ),
)
def dispatch_investigation_orchestration_create(orchestration_run_id: int) -> None:
    run = (
        InvestigationOrchestrationRun.objects.select_related("investigation__organization")
        .filter(id=orchestration_run_id)
        .first()
    )
    if run is None:
        return
    if run.seer_run_id is not None:
        dispatch_investigation_orchestration_commands.delay(run.id)
        return
    viewer_context = SeerViewerContext(organization_id=run.investigation.organization_id)
    if run.investigation.created_by_id is not None:
        viewer_context["user_id"] = run.investigation.created_by_id
    try:
        response = create_investigation_orchestration_run(run, viewer_context=viewer_context)
        seer_run_id, projection = _response_projection(response)
        synchronize_orchestration_projection(
            orchestration_run_id=run.id,
            seer_run_id=seer_run_id,
            projection=projection,
        )
    except (SeerApiError, HTTPError) as error:
        if _is_last_dispatch_attempt():
            logger.exception("investigations.orchestration.create_dispatch_failed")
            _mark_create_dispatch_failed(run.id, error)
            return
        raise
    except serializers.ValidationError as error:
        logger.exception("investigations.orchestration.create_response_invalid")
        _mark_create_dispatch_failed(run.id, error)
        return
    dispatch_investigation_orchestration_commands.delay(run.id)


@instrumented_task(
    name="sentry.tasks.seer.investigation.dispatch_investigation_orchestration_commands",
    namespace=seer_tasks,
    retry=Retry(
        times=ORCHESTRATION_DISPATCH_RETRIES,
        delay=2,
        on=(SeerApiError, HTTPError),
    ),
)
def dispatch_investigation_orchestration_commands(orchestration_run_id: int) -> None:
    run = (
        InvestigationOrchestrationRun.objects.select_related("investigation__organization")
        .filter(id=orchestration_run_id)
        .first()
    )
    if run is None:
        return
    if run.seer_run_id is None:
        error = SeerApiError("The investigation run has not been created", 409)
        if _is_last_dispatch_attempt():
            command = (
                run.commands.filter(
                    status__in=(
                        InvestigationOrchestrationCommandStatus.ACCEPTED,
                        InvestigationOrchestrationCommandStatus.DISPATCHED,
                    )
                )
                .order_by("id")
                .first()
            )
            if command is not None:
                _mark_command_dispatch_failed(command.id, error)
            return
        raise error

    while True:
        command = (
            InvestigationOrchestrationCommand.objects.select_related(
                "orchestration_run__investigation__organization"
            )
            .filter(
                orchestration_run=run,
                status__in=(
                    InvestigationOrchestrationCommandStatus.ACCEPTED,
                    InvestigationOrchestrationCommandStatus.DISPATCHED,
                ),
            )
            .order_by("id")
            .first()
        )
        if command is None:
            return
        if command.status == InvestigationOrchestrationCommandStatus.ACCEPTED:
            InvestigationOrchestrationCommand.objects.filter(
                id=command.id,
                status=InvestigationOrchestrationCommandStatus.ACCEPTED,
            ).update(
                status=InvestigationOrchestrationCommandStatus.DISPATCHED,
                date_updated=timezone.now(),
            )
            command.status = InvestigationOrchestrationCommandStatus.DISPATCHED

        viewer_context = SeerViewerContext(organization_id=run.investigation.organization_id)
        if command.actor_id is not None:
            viewer_context["user_id"] = command.actor_id
        try:
            response = dispatch_investigation_orchestration_command(
                command,
                seer_run_id=run.seer_run_id,
                viewer_context=viewer_context,
            )
            response_run_id, projection = _response_projection(response)
            response_request_id = response.get("requestId")
            if response_request_id != str(command.request_id):
                raise SeerApiError("Seer acknowledged a different command", 502)
            synchronize_orchestration_projection(
                orchestration_run_id=run.id,
                seer_run_id=response_run_id,
                projection=projection,
            )
        except (SeerApiError, HTTPError) as error:
            if _is_last_dispatch_attempt():
                logger.exception("investigations.orchestration.command_dispatch_failed")
                _mark_command_dispatch_failed(command.id, error)
                return
            raise
        except serializers.ValidationError as error:
            logger.exception("investigations.orchestration.command_response_invalid")
            _mark_command_dispatch_failed(command.id, error)
            return

        _mark_command_dispatch_acknowledged(run.id, command.id)


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
