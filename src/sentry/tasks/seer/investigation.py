from __future__ import annotations

import logging
from copy import deepcopy

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
    Investigation,
    InvestigationBlockExecution,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.investigations.seer_client import (
    create_investigation_orchestration_run,
    dispatch_investigation_orchestration_command,
    get_investigation_orchestration_run,
)
from sentry.investigations.services import (
    mark_block_execution_dispatch_failed,
    mark_block_execution_dispatch_started,
)
from sentry.investigations.services.orchestration_events import (
    reconcile_orchestration_projection,
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
COMMAND_VERSION_CONFLICT_MESSAGE = (
    "The investigation changed before this update could be applied. "
    "Progress was refreshed; try again."
)


def _is_last_dispatch_attempt() -> bool:
    task_state = current_task()
    return task_state is not None and not task_state.retries_remaining


def _lock_orchestration_run(run_id: int) -> InvestigationOrchestrationRun | None:
    investigation = (
        Investigation.objects.select_for_update(of=("self",))
        .filter(orchestration_run__id=run_id)
        .first()
    )
    if investigation is None:
        return None
    return (
        InvestigationOrchestrationRun.objects.select_for_update(of=("self",))
        .filter(id=run_id)
        .first()
    )


def _mark_create_dispatch_failed(run_id: int) -> None:
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = _lock_orchestration_run(run_id)
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


def _mark_command_dispatch_failed(command_id: int) -> None:
    database = router.db_for_write(InvestigationOrchestrationCommand)
    with transaction.atomic(using=database):
        command_snapshot = InvestigationOrchestrationCommand.objects.filter(id=command_id).first()
        if command_snapshot is None:
            return
        run = _lock_orchestration_run(command_snapshot.orchestration_run_id)
        if run is None:
            return
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


def _mark_command_version_conflicted(command_id: int) -> None:
    database = router.db_for_write(InvestigationOrchestrationCommand)
    with transaction.atomic(using=database):
        command_snapshot = InvestigationOrchestrationCommand.objects.filter(id=command_id).first()
        if command_snapshot is None:
            return
        run = _lock_orchestration_run(command_snapshot.orchestration_run_id)
        if run is None:
            return
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
            "message": COMMAND_VERSION_CONFLICT_MESSAGE,
            "requestId": str(command.request_id),
            "commandType": command.type,
            "reason": "workflow_version_conflict",
            "retryable": False,
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
                "code": "earlier_command_conflicted",
                "message": "An earlier workflow update conflicted with Seer's current state.",
            },
            date_updated=timezone.now(),
        )
        projection = deepcopy(run.projection)
        errors = projection.setdefault("errors", [])
        if isinstance(errors, list):
            projection["errors"] = [detail, *errors]
        if run.error is None:
            run.error = detail
        run.projection = projection
        run.save(update_fields=["error", "projection", "date_updated"])


def _reconcile_command_version_conflict(
    run: InvestigationOrchestrationRun,
    command: InvestigationOrchestrationCommand,
    viewer_context: SeerViewerContext,
) -> None:
    if run.seer_run_id is None:
        raise SeerApiError("Investigation orchestration run is missing", 502)
    response = get_investigation_orchestration_run(
        run.seer_run_id,
        viewer_context=viewer_context,
    )
    response_run_id = response["runId"]
    projection = response["projection"]
    reconcile_orchestration_projection(
        orchestration_run_id=run.id,
        seer_run_id=response_run_id,
        projection=projection,
    )
    _mark_command_version_conflicted(command.id)


def _mark_command_dispatch_acknowledged(
    orchestration_run_id: int,
    command_id: int,
) -> None:
    database = router.db_for_write(InvestigationOrchestrationCommand)
    with transaction.atomic(using=database):
        run = _lock_orchestration_run(orchestration_run_id)
        if run is None:
            return
        command = InvestigationOrchestrationCommand.objects.select_for_update().get(id=command_id)
        recovered_dispatch_failure = (
            command.status == InvestigationOrchestrationCommandStatus.FAILED
            and isinstance(command.error, dict)
            and command.error.get("code") == "seer_command_dispatch_failed"
            and command.error.get("retryable") is True
        )
        command.status = InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        command.error = None
        command.save(update_fields=["status", "error", "date_updated"])
        if recovered_dispatch_failure:
            blocked_commands = list(
                InvestigationOrchestrationCommand.objects.select_for_update()
                .filter(
                    orchestration_run=run,
                    id__gt=command.id,
                    status=InvestigationOrchestrationCommandStatus.FAILED,
                )
                .order_by("id")
            )
            now = timezone.now()
            requeued_commands = []
            for blocked_command in blocked_commands:
                if (
                    isinstance(blocked_command.error, dict)
                    and blocked_command.error.get("code") == "earlier_command_failed"
                ):
                    blocked_command.status = InvestigationOrchestrationCommandStatus.ACCEPTED
                    blocked_command.error = None
                    blocked_command.date_updated = now
                    requeued_commands.append(blocked_command)
            if requeued_commands:
                InvestigationOrchestrationCommand.objects.bulk_update(
                    requeued_commands,
                    ["status", "error", "date_updated"],
                )
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
        seer_run_id = response["runId"]
        projection = response["projection"]
        synchronize_orchestration_projection(
            orchestration_run_id=run.id,
            seer_run_id=seer_run_id,
            projection=projection,
        )
    except (SeerApiError, HTTPError):
        if _is_last_dispatch_attempt():
            logger.exception("investigations.orchestration.create_dispatch_failed")
            _mark_create_dispatch_failed(run.id)
            return
        raise
    except serializers.ValidationError:
        logger.exception("investigations.orchestration.create_response_invalid")
        _mark_create_dispatch_failed(run.id)
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
        dispatch_investigation_orchestration_create.delay(run.id)
        return

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
                viewer_context=viewer_context,
            )
            response_run_id = response["runId"]
            projection = response["projection"]
            if response.get("requestId") != str(command.request_id):
                raise SeerApiError("Seer acknowledged a different command", 502)
            synchronize_orchestration_projection(
                orchestration_run_id=run.id,
                seer_run_id=response_run_id,
                projection=projection,
            )
        except SeerApiError as error:
            if error.status == 409:
                logger.warning(
                    "investigations.orchestration.command_version_conflict",
                    extra={
                        "orchestration_run_id": run.id,
                        "seer_run_id": run.seer_run_id,
                        "command_id": command.id,
                        "expected_workflow_version": command.expected_workflow_version,
                    },
                )
                try:
                    _reconcile_command_version_conflict(run, command, viewer_context)
                except (SeerApiError, HTTPError):
                    if _is_last_dispatch_attempt():
                        logger.exception(
                            "investigations.orchestration.command_conflict_reconciliation_failed"
                        )
                        _mark_command_dispatch_failed(command.id)
                        return
                    raise
                except serializers.ValidationError:
                    logger.exception(
                        "investigations.orchestration.command_conflict_response_invalid"
                    )
                    _mark_command_dispatch_failed(command.id)
                return
            if _is_last_dispatch_attempt():
                logger.exception("investigations.orchestration.command_dispatch_failed")
                _mark_command_dispatch_failed(command.id)
                return
            raise
        except HTTPError:
            if _is_last_dispatch_attempt():
                logger.exception("investigations.orchestration.command_dispatch_failed")
                _mark_command_dispatch_failed(command.id)
                return
            raise
        except serializers.ValidationError:
            logger.exception("investigations.orchestration.command_response_invalid")
            _mark_command_dispatch_failed(command.id)
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
