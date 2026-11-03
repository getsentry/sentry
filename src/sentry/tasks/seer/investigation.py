from __future__ import annotations

import logging
from contextlib import AbstractContextManager, nullcontext
from datetime import timedelta

from django.db import router, transaction
from django.utils import timezone
from rest_framework import serializers
from taskbroker_client.retry import Retry
from taskbroker_client.state import current_task
from urllib3.exceptions import HTTPError

from sentry import features
from sentry.investigations.agent import (
    cancel_investigation_executions_after_failure,
    start_execution_run,
)
from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRerun,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.investigations.seer_client import (
    CommandRejectionCode,
    SeerCommandRejected,
    create_investigation_orchestration_run,
    dispatch_investigation_orchestration_command,
    get_investigation_orchestration_run,
)
from sentry.investigations.services.action_kinds.connect_telemetry import (
    TELEMETRY_FEATURE,
    ConnectTelemetryAppliedDetails,
    TelemetryProvider,
    open_connect_requests,
    telemetry_available,
)
from sentry.investigations.services.action_requests import complete_action_requests
from sentry.investigations.services.orchestration import (
    FOLLOW_UP_COMMAND_TYPES,
    INTERNAL_COMMAND_TYPES,
    clear_command_dispatch_error,
    requeue_commands_behind,
    schedule_orchestration_commands,
)
from sentry.investigations.services.orchestration_events import (
    InvestigationOrchestrationEventConflict,
    reconcile_orchestration_projection,
    schedule_investigation_updates,
    synchronize_orchestration_projection,
)
from sentry.investigations.telemetry import record_execution_failed
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook, NotebookBlockExecution
from sentry.notebooks.services import (
    mark_block_execution_dispatch_failed,
    mark_block_execution_dispatch_started,
)
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.services.user.service import user_service
from sentry.viewer_context import Actor, ActorType, ViewerContext, viewer_context_scope

logger = logging.getLogger(__name__)

ORCHESTRATION_DISPATCH_RETRIES = 3
CREATE_DISPATCH_ERROR_MESSAGE = "Unable to start this investigation. Try again."
COMMAND_DISPATCH_ERROR_MESSAGE = "Unable to deliver this investigation command. Try again."
COMMAND_VERSION_CONFLICT_MESSAGE = (
    "The investigation changed before this update could be applied. "
    "Progress was refreshed; try again."
)
INTERNAL_COMMAND_REJECTED_MESSAGE = "Seer turned down this update."
AUTO_CONNECT_MAX_AGE = timedelta(days=1)


def _is_last_dispatch_attempt() -> bool:
    task_state = current_task()
    return task_state is not None and not task_state.retries_remaining


def _lock_orchestration_run(run_id: int) -> InvestigationOrchestrationRun | None:
    investigation = (
        Notebook.objects.select_for_update(of=("self",))
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
        run.projection.update({"phase": run.phase, "status": run.status})
        errors = run.projection.setdefault("errors", [])
        if isinstance(errors, list):
            errors.append(detail)
        run.save(update_fields=["phase", "status", "error", "projection", "date_updated"])
        schedule_investigation_updates(run.investigation_id, database)


def _fail_commands_after(
    run: InvestigationOrchestrationRun,
    command: InvestigationOrchestrationCommand,
    error: dict[str, str],
) -> bool:
    """Fail the commands queued behind a failed one, and say whether a user command was among
    them. Internal commands still go out.
    """

    later = InvestigationOrchestrationCommand.objects.filter(
        orchestration_run=run, id__gt=command.id
    )
    blocked = later.filter(
        status__in=(
            InvestigationOrchestrationCommandStatus.ACCEPTED,
            InvestigationOrchestrationCommandStatus.DISPATCHED,
        )
    ).exclude(type__in=INTERNAL_COMMAND_TYPES)
    blocked_user_command = blocked.exclude(type__in=FOLLOW_UP_COMMAND_TYPES).exists()
    blocked.update(
        status=InvestigationOrchestrationCommandStatus.FAILED,
        error=error,
        date_updated=timezone.now(),
    )
    return blocked_user_command


def _mark_command_dispatch_failed(command_id: int) -> None:
    database = router.db_for_write(InvestigationOrchestrationCommand)
    with transaction.atomic(using=database):
        command_snapshot = InvestigationOrchestrationCommand.objects.filter(id=command_id).first()
        if command_snapshot is None:
            return
        run = _lock_orchestration_run(command_snapshot.orchestration_run_id)
        if run is None:
            return
        # The dispatch task stops after this, so send whatever's still queued.
        schedule_orchestration_commands(run.id)
        command = (
            InvestigationOrchestrationCommand.objects.select_for_update()
            .filter(id=command_id)
            .first()
        )
        # A rerun_updated event means Seer has it, whatever happened to the response.
        if (
            command is None
            or command.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
            or command.rerun is not None
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
        if command.type in INTERNAL_COMMAND_TYPES:
            # Losing it isn't a run error, and no other command waits on it.
            return
        blocked_user_command = _fail_commands_after(
            run,
            command,
            {
                "code": "earlier_command_failed",
                "message": "An earlier workflow command could not be delivered.",
            },
        )
        # A follow-up's request shows how it went, unless user commands failed behind it.
        if command.type in FOLLOW_UP_COMMAND_TYPES and not blocked_user_command:
            return
        errors = run.projection.setdefault("errors", [])
        if isinstance(errors, list):
            errors.append(detail)
        run.error = detail
        run.save(update_fields=["error", "projection", "date_updated"])


def _mark_command_version_conflicted(command_id: int, reason: CommandRejectionCode) -> None:
    database = router.db_for_write(InvestigationOrchestrationCommand)
    with transaction.atomic(using=database):
        command_snapshot = InvestigationOrchestrationCommand.objects.filter(id=command_id).first()
        if command_snapshot is None:
            return
        run = _lock_orchestration_run(command_snapshot.orchestration_run_id)
        if run is None:
            return
        # The dispatch task stops after this, so send whatever's still queued.
        schedule_orchestration_commands(run.id)
        command = (
            InvestigationOrchestrationCommand.objects.select_for_update()
            .filter(id=command_id)
            .first()
        )
        if (
            command is None
            or command.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
            or command.rerun is not None
        ):
            return
        detail = {
            "code": "seer_command_dispatch_failed",
            "message": COMMAND_VERSION_CONFLICT_MESSAGE,
            "requestId": str(command.request_id),
            "commandType": command.type,
            "reason": reason,
            "retryable": False,
        }
        command.status = InvestigationOrchestrationCommandStatus.FAILED
        command.error = detail
        command.save(update_fields=["status", "error", "date_updated"])
        blocked_user_command = _fail_commands_after(
            run,
            command,
            {
                "code": "earlier_command_conflicted",
                "message": "An earlier workflow update conflicted with Seer's current state.",
            },
        )
        # A follow-up's request shows how it went, unless user commands failed behind it.
        if command.type in FOLLOW_UP_COMMAND_TYPES and not blocked_user_command:
            return
        errors = run.projection.setdefault("errors", [])
        if isinstance(errors, list):
            run.projection["errors"] = [detail, *errors]
        if run.error is None:
            run.error = detail
        run.save(update_fields=["error", "projection", "date_updated"])


def _mark_internal_command_rejected(command_id: int, code: CommandRejectionCode | None) -> None:
    """Fail an internal command Seer turned down. It isn't a run error, and no other command
    waits on it.
    """

    database = router.db_for_write(InvestigationOrchestrationCommand)
    with transaction.atomic(using=database):
        command_snapshot = InvestigationOrchestrationCommand.objects.filter(id=command_id).first()
        if command_snapshot is None:
            return
        run = _lock_orchestration_run(command_snapshot.orchestration_run_id)
        if run is None:
            return
        # The dispatch task stops after this, so send whatever's still queued.
        schedule_orchestration_commands(run.id)
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
        command.status = InvestigationOrchestrationCommandStatus.FAILED
        command.error = {
            "code": "seer_command_rejected",
            "message": INTERNAL_COMMAND_REJECTED_MESSAGE,
            "requestId": str(command.request_id),
            "commandType": command.type,
            "reason": code,
            "retryable": False,
        }
        command.save(update_fields=["status", "error", "date_updated"])


def _command_viewer_scope(
    command: InvestigationOrchestrationCommand, organization_id: int
) -> AbstractContextManager[None]:
    if command.actor_id is not None:
        return nullcontext()
    # Without an acting user, send it as Sentry. The task's inherited context can be missing,
    # or belong to someone else, and Seer rejects an unknown actor.
    return viewer_context_scope(
        ViewerContext(organization_id=organization_id, actor=Actor(type=ActorType.SYSTEM))
    )


def _reconcile_command_version_conflict(
    run: InvestigationOrchestrationRun,
    command: InvestigationOrchestrationCommand,
    viewer_context: SeerViewerContext,
    reason: CommandRejectionCode,
) -> None:
    run.refresh_from_db()
    if run.seer_run_id is None:
        raise SeerApiError("Investigation orchestration run is missing", 502)
    response = get_investigation_orchestration_run(
        run,
        viewer_context=viewer_context,
    )
    response_run_id = response["runId"]
    projection = response["projection"]
    try:
        with transaction.atomic(using=router.db_for_write(InvestigationOrchestrationRun)):
            reconcile_orchestration_projection(
                orchestration_run_id=run.id,
                seer_run_id=response_run_id,
                projection=projection,
                expected_last_event_sequence=run.last_event_sequence,
                expected_workflow_version=run.workflow_version,
            )
            _mark_command_version_conflicted(command.id, reason)
    except InvestigationOrchestrationEventConflict as error:
        raise SeerApiError("Investigation changed while reconciling", 502) from error


def _mark_command_dispatch_acknowledged(
    orchestration_run_id: int,
    command_id: int,
    rerun: InvestigationOrchestrationRerun | None,
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
        # Seer's rerun_updated event can arrive before its response, and it's newer.
        if command.rerun is None:
            command.rerun = rerun
        if command.rerun != InvestigationOrchestrationRerun.SKIPPED:
            command.status = InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
            command.error = None
        command.save(update_fields=["status", "error", "rerun", "date_updated"])
        if recovered_dispatch_failure:
            requeue_commands_behind(run, command)
        clear_command_dispatch_error(run, request_id=command.request_id)
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
            with _command_viewer_scope(command, run.investigation.organization_id):
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
            if error.status == 409 and command.type in INTERNAL_COMMAND_TYPES:
                code = error.code if isinstance(error, SeerCommandRejected) else None
                logger.warning(
                    "investigations.orchestration.internal_command_rejected",
                    extra={
                        "orchestration_run_id": run.id,
                        "seer_run_id": run.seer_run_id,
                        "command_id": command.id,
                        "command_type": command.type,
                        "code": code,
                    },
                )
                _mark_internal_command_rejected(command.id, code)
                return
            if error.status == 409:
                reason: CommandRejectionCode = (
                    error.code
                    if isinstance(error, SeerCommandRejected)
                    else "workflow_version_conflict"
                )
                logger.warning(
                    "investigations.orchestration.command_version_conflict",
                    extra={
                        "orchestration_run_id": run.id,
                        "seer_run_id": run.seer_run_id,
                        "command_id": command.id,
                        "expected_workflow_version": command.expected_workflow_version,
                        "reason": reason,
                    },
                )
                try:
                    with _command_viewer_scope(command, run.investigation.organization_id):
                        _reconcile_command_version_conflict(run, command, viewer_context, reason)
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

        _mark_command_dispatch_acknowledged(run.id, command.id, response["rerun"])


@instrumented_task(
    name="sentry.tasks.seer.investigation.dispatch_investigation_execution",
    namespace=seer_tasks,
)
def dispatch_investigation_execution(execution_id: int) -> None:
    execution = (
        NotebookBlockExecution.objects.select_related("block__notebook__organization")
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
            execution.block.notebook.organization,
            user,
            dispatch_claimed_at=dispatch_claimed_at,
        )
    except Exception:
        logger.exception("investigations.execution.dispatch_failed")
        if mark_block_execution_dispatch_failed(execution, dispatch_claimed_at=dispatch_claimed_at):
            execution.refresh_from_db(fields=["completed_at"])
            record_execution_failed(execution, reason="dispatch_failed", seer_run_id=None)
            cancel_investigation_executions_after_failure(execution)


class TelemetryNotConnectedYet(Exception):
    pass


@instrumented_task(
    name="sentry.tasks.seer.investigation.mark_investigation_telemetry_connected",
    namespace=seer_tasks,
    retry=Retry(times=2, delay=60, on=(TelemetryNotConnectedYet,)),
)
def mark_investigation_telemetry_connected(
    organization_id: int,
    provider: TelemetryProvider,
    user_id: int | None = None,
    retry: bool = True,
) -> None:
    """Apply open connect requests when the organization connects a provider.

    Install hooks retry, because a hook can run before the integration's settings are saved.
    """

    connect_requests = open_connect_requests(organization_id, provider).filter(
        date_added__gte=timezone.now() - AUTO_CONNECT_MAX_AGE
    )
    if not connect_requests.exists():
        return
    organization = Organization.objects.filter(id=organization_id).first()
    if organization is None or not features.has(TELEMETRY_FEATURE, organization):
        return
    if not telemetry_available(organization, provider):
        if retry and not _is_last_dispatch_attempt():
            raise TelemetryNotConnectedYet
        return
    complete_action_requests(
        connect_requests,
        applied_by=user_id,
        details=ConnectTelemetryAppliedDetails(provider=provider),
    )
