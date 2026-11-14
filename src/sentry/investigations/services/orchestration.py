from __future__ import annotations

import logging
from collections.abc import Callable
from collections.abc import Set as AbstractSet
from copy import deepcopy
from dataclasses import dataclass
from functools import partial
from typing import Any
from uuid import UUID, uuid5

from django.db import router, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.investigations.services.actor_access import (
    resolve_investigation_service_account,
    user_can_investigate,
)
from sentry.investigations.services.breached_metrics import (
    BreachedMetricSource,
    resolve_breached_metric_sources,
    resolve_investigation_source,
)
from sentry.models.organization import Organization
from sentry.notebooks.models import (
    Notebook,
    NotebookBlockExecution,
    NotebookBlockExecutionStatus,
    NotebookSourceType,
    NotebookStatus,
)
from sentry.notebooks.services.notebooks import (
    NotebookConflictError,
    NotebookSourceNotFound,
    NotebookValidationError,
    _validate_project_ids,
    archive_notebook_row,
    create_notebook,
    default_notebook_title,
    get_or_create_source_notebook,
    update_notebook_row,
)
from sentry.users.services.user.service import user_service
from sentry.viewer_context import ActorId, ActorType

logger = logging.getLogger(__name__)

_ARCHIVE_CANCEL_NAMESPACE = UUID("cde61615-4bc3-43a4-a022-1608dc33d512")
_CONTROL_KEY = "_sentryControl"


@dataclass(frozen=True)
class AcceptedOrchestrationCommand:
    run_id: int | None
    request_id: UUID
    duplicate: bool
    workflow_version: int
    status: str
    error: dict[str, Any] | None
    projection: dict[str, Any]


__all__ = [
    "AcceptedOrchestrationCommand",
    "accept_orchestration_command",
    "agentic_breached_metric_source_key",
    "archive_investigation_with_orchestration",
    "create_agentic_breached_metric_investigation",
    "create_agentic_manual_investigation",
    "get_orchestration_projection",
    "start_investigation",
    "update_investigation_with_orchestration",
]


def _initial_projection(
    *, investigation_id: int, source: dict[str, Any]
) -> tuple[str, str, dict[str, Any]]:
    source_type = source["type"]
    missing_fields: list[str] = []
    if source_type == "manual":
        prompt = source.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            missing_fields.append("prompt")

    awaiting_input = bool(missing_fields)
    phase = "intake" if awaiting_input else "broad_scan"
    status = (
        InvestigationOrchestrationStatus.AWAITING_INPUT
        if awaiting_input
        else InvestigationOrchestrationStatus.PENDING
    )
    return (
        phase,
        status,
        {
            "runId": None,
            "investigationId": str(investigation_id),
            "sourceType": source_type,
            "workflowVersion": 1,
            "generation": 1,
            "phase": phase,
            "status": status,
            "broadScan": {
                "status": "blocked" if awaiting_input else "queued",
                "summary": None,
                "error": None,
            },
            "hypotheses": [],
            "report": {
                "revision": 0,
                "status": "not_started",
                "includedHypothesisIds": [],
                "primaryHypothesisId": None,
                "currentBlockKey": None,
                "notebookRevision": 0,
                "metadata": {
                    "status": "not_started",
                    "title": None,
                    "summary": None,
                    "summaryDescription": None,
                    "error": None,
                },
                "error": None,
            },
            "pendingInput": (
                {
                    "missingFields": missing_fields,
                    "prompt": "Provide the missing investigation context to begin the broad scan.",
                }
                if awaiting_input
                else None
            ),
            "errors": [],
            "heartbeatAt": None,
        },
    )


def _validate_creation_actor(
    *, organization: Organization, creator: ActorId, project_ids: list[int]
) -> None:
    if (
        creator.type not in (ActorType.USER, ActorType.SERVICE_ACCOUNT)
        or type(creator.id) is not int
        or creator.id <= 0
    ):
        raise NotebookValidationError(
            {"creator": "A user or service account with a positive integer ID is required."}
        )
    if creator.type == ActorType.USER:
        if not user_can_investigate(organization, user_service.get_user(user_id=creator.id)):
            raise PermissionDenied
        # Open membership grants authorized human members access to every active project.
        _validate_project_ids(organization.id, project_ids)
    else:
        resolve_investigation_service_account(
            organization=organization, account_id=creator.id, project_ids=project_ids
        )


def _create_agentic_investigation(
    *,
    organization: Organization,
    creator: ActorId,
    title: str | None,
    source: dict[str, Any],
    orchestration_source: dict[str, Any],
    project_ids: list[int],
    filters: dict[str, Any],
    source_type: str = NotebookSourceType.MANUAL,
    source_key: str | None = None,
    source_revision: int | None = None,
) -> tuple[Notebook, InvestigationOrchestrationRun]:
    """Create the notebook and its parent control-plane aggregate atomically."""

    with transaction.atomic(using=router.db_for_write(Notebook)):
        investigation = create_notebook(
            organization=organization,
            created_by_id=creator.id if creator.type == ActorType.USER else None,
            created_by_service_account_id=(
                creator.id if creator.type == ActorType.SERVICE_ACCOUNT else None
            ),
            title=title or default_notebook_title(source_type),
            source_type=source_type,
            source_key=source_key,
            source=source,
            source_revision=source_revision,
            filters=filters,
            project_ids=project_ids,
        )
        phase, status, projection = _initial_projection(
            investigation_id=investigation.id, source=orchestration_source
        )
        orchestration_run = InvestigationOrchestrationRun.objects.create(
            investigation=investigation,
            phase=phase,
            status=status,
            source=deepcopy(orchestration_source),
            projection=projection,
        )
        _schedule_orchestration_create(orchestration_run.id)
    return investigation, orchestration_run


def _hypothesis_ids(run: InvestigationOrchestrationRun) -> set[str]:
    hypotheses = run.projection.get("hypotheses")
    if not isinstance(hypotheses, list):
        return set()
    return {
        hypothesis["id"]
        for hypothesis in hypotheses
        if isinstance(hypothesis, dict) and isinstance(hypothesis.get("id"), str)
    }


def _validate_command_target(
    run: InvestigationOrchestrationRun,
    *,
    request_id: UUID,
    command_type: str,
    payload: dict[str, Any],
) -> None:
    hypothesis_id: Any = None
    targets_hypothesis = command_type == "set_hypothesis_disposition"
    if targets_hypothesis:
        hypothesis_id = payload.get("hypothesisId")
    elif command_type in {"steer", "retry"} and payload.get("target") == "hypothesis":
        targets_hypothesis = True
        hypothesis_id = payload.get("targetId")
    if targets_hypothesis and (
        not isinstance(hypothesis_id, str) or hypothesis_id not in _hypothesis_ids(run)
    ):
        logger.info(
            "investigation.orchestration.command.invalid_hypothesis",
            extra={
                "investigation_id": run.investigation_id,
                "orchestration_run_id": run.id,
                "request_id": str(request_id),
                "command_type": command_type,
                "hypothesis_id": hypothesis_id if isinstance(hypothesis_id, str) else None,
            },
        )
        raise NotebookValidationError({"detail": "Hypothesis was not found."})


def clear_command_dispatch_error(
    run: InvestigationOrchestrationRun,
    *,
    request_id: UUID,
) -> None:
    errors = run.projection.get("errors")
    if isinstance(errors, list):
        run.projection["errors"] = [
            error
            for error in errors
            if not (
                isinstance(error, dict)
                and error.get("code") == "seer_command_dispatch_failed"
                and error.get("requestId") == str(request_id)
            )
        ]
    if (
        isinstance(run.error, dict)
        and run.error.get("code") == "seer_command_dispatch_failed"
        and run.error.get("requestId") == str(request_id)
    ):
        run.error = None


def requeue_commands_behind(
    run: InvestigationOrchestrationRun,
    command: InvestigationOrchestrationCommand,
) -> int:
    """Queue the commands that failed because this one did, and return how many."""

    return InvestigationOrchestrationCommand.objects.filter(
        orchestration_run=run,
        id__gt=command.id,
        status=InvestigationOrchestrationCommandStatus.FAILED,
        error__code="earlier_command_failed",
    ).update(
        status=InvestigationOrchestrationCommandStatus.ACCEPTED,
        error=None,
        date_updated=timezone.now(),
    )


def _requeue_failed_command(
    run: InvestigationOrchestrationRun,
    command: InvestigationOrchestrationCommand,
) -> None:
    command.update(
        status=InvestigationOrchestrationCommandStatus.ACCEPTED,
        error=None,
        date_updated=timezone.now(),
    )
    requeue_commands_behind(run, command)
    clear_command_dispatch_error(run, request_id=command.request_id)
    run.save(update_fields=["projection", "error", "date_updated"])


def command_can_be_requeued(command: InvestigationOrchestrationCommand) -> bool:
    return command_error_can_be_requeued(command.error)


def command_error_can_be_requeued(error: object) -> bool:
    return (
        isinstance(error, dict)
        and error.get("code") == "seer_command_dispatch_failed"
        and error.get("retryable") is True
    )


def command_can_be_resent(command_type: str, error: object) -> bool:
    """Whether a failed command never reached Seer and can go out again as it is."""

    if command_error_can_be_requeued(error):
        return True
    # A conflict ahead of it doesn't matter to Seer, since it doesn't check the version.
    return (
        command_type in UNVERSIONED_COMMAND_TYPES
        and isinstance(error, dict)
        and error.get("code") == "earlier_command_conflicted"
    )


def follow_up_can_be_retried(command_type: str, error: object) -> bool:
    """Whether a failed follow-up can be tried again."""

    if command_type == "recheck_action_requests":
        # A retried re-check goes out as a new command, unless Seer said the report moved on.
        # One behind an undelivered command goes out when that command does.
        return not (
            isinstance(error, dict)
            and (
                error.get("reason") == "action_requests_report_changed"
                or error.get("code") == "earlier_command_failed"
            )
        )
    return command_can_be_resent(command_type, error)


def _reset_create_dispatch_failure(run: InvestigationOrchestrationRun) -> None:
    awaiting_input = isinstance(run.projection.get("pendingInput"), dict)
    run.phase = (
        InvestigationOrchestrationPhase.INTAKE
        if awaiting_input
        else InvestigationOrchestrationPhase.BROAD_SCAN
    )
    run.status = (
        InvestigationOrchestrationStatus.AWAITING_INPUT
        if awaiting_input
        else InvestigationOrchestrationStatus.PENDING
    )
    run.error = None
    run.projection.update({"phase": run.phase, "status": run.status})
    errors = run.projection.get("errors")
    if isinstance(errors, list):
        run.projection["errors"] = [
            error
            for error in errors
            if not (isinstance(error, dict) and error.get("code") == "seer_dispatch_failed")
        ]


# Commands that only keep Seer's action requests in sync. Neither side checks or moves the
# workflow version for them.
INTERNAL_COMMAND_TYPES = frozenset({"record_action_outcome"})
# Commands Seer runs whatever its workflow version is. Sentry still moves the version for them.
UNVERSIONED_COMMAND_TYPES = frozenset({"rerun_after_connection"})
# Commands Sentry sends for an action request, which shows how they went.
FOLLOW_UP_COMMAND_TYPES = frozenset({"recheck_action_requests", "rerun_after_connection"})


def _is_run_retry(command_type: str, payload: dict[str, Any]) -> bool:
    return command_type == "retry" and payload.get("target") == "run"


def _schedule_orchestration_create(run_id: int) -> None:
    from sentry.tasks.seer.investigation import dispatch_investigation_orchestration_create

    transaction.on_commit(
        partial(dispatch_investigation_orchestration_create.delay, run_id),
        using=router.db_for_write(InvestigationOrchestrationRun),
    )


def schedule_orchestration_commands(run_id: int) -> None:
    from sentry.tasks.seer.investigation import dispatch_investigation_orchestration_commands

    transaction.on_commit(
        partial(dispatch_investigation_orchestration_commands.delay, run_id),
        using=router.db_for_write(InvestigationOrchestrationRun),
    )


def archive_investigation_with_orchestration(
    *, investigation: Notebook, expected_version: int, actor: ActorId
) -> Notebook:
    user_id = actor.id if actor.type == ActorType.USER else None
    service_account_id = actor.id if actor.type == ActorType.SERVICE_ACCOUNT else None
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        try:
            locked_investigation = Notebook.objects.select_for_update().get(id=investigation.id)
        except Notebook.DoesNotExist:
            raise NotebookSourceNotFound
        run = (
            InvestigationOrchestrationRun.objects.select_for_update()
            .filter(investigation=locked_investigation)
            .first()
        )
        if run is not None and user_id is None and service_account_id is None:
            raise PermissionDenied
        archive_version = expected_version
        if run is None:
            if locked_investigation.version != expected_version:
                raise NotebookConflictError("Investigation has changed.")
        else:
            if expected_version > locked_investigation.version:
                raise NotebookConflictError("Investigation has changed.")
            archive_version = locked_investigation.version
        if locked_investigation.status == NotebookStatus.ARCHIVED:
            return locked_investigation
        if run is not None and run.status not in {
            InvestigationOrchestrationStatus.COMPLETED,
            InvestigationOrchestrationStatus.FAILED,
            InvestigationOrchestrationStatus.CANCELLED,
        }:
            accept_orchestration_command(
                investigation=locked_investigation,
                request_id=uuid5(
                    _ARCHIVE_CANCEL_NAMESPACE,
                    f"{locked_investigation.id}:{archive_version}",
                ),
                expected_workflow_version=run.workflow_version,
                command_type="cancel",
                payload={"reason": "investigation_archived"},
                actor_id=user_id,
                service_account_id=service_account_id,
            )
        if run is not None:
            run.refresh_from_db(fields=["generation", "projection"])
            control = run.projection.setdefault(_CONTROL_KEY, {})
            assert isinstance(control, dict)
            control["notebookWriteFenceGeneration"] = run.generation
            run.date_updated = timezone.now()
            run.save(update_fields=["projection", "date_updated"])
            now = timezone.now()
            NotebookBlockExecution.objects.filter(
                block__notebook=locked_investigation,
                status__in=(
                    NotebookBlockExecutionStatus.PENDING,
                    NotebookBlockExecutionStatus.RUNNING,
                    NotebookBlockExecutionStatus.AWAITING_INPUT,
                    NotebookBlockExecutionStatus.STOPPING,
                ),
            ).update(
                status=NotebookBlockExecutionStatus.CANCELLED,
                error={
                    "code": "investigation_archived",
                    "message": "The investigation was archived.",
                },
                completed_at=now,
                date_updated=now,
            )
        return archive_notebook_row(
            notebook=locked_investigation,
            expected_version=archive_version,
        )


def update_investigation_with_orchestration(
    *,
    investigation: Notebook,
    expected_version: int,
    fields: dict[str, Any],
    project_ids: list[int] | None,
) -> Notebook:
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        try:
            locked_investigation = Notebook.objects.select_for_update().get(id=investigation.id)
        except Notebook.DoesNotExist:
            raise NotebookSourceNotFound
        run = (
            InvestigationOrchestrationRun.objects.select_for_update()
            .filter(investigation=locked_investigation)
            .first()
        )
        if (
            run is not None
            and locked_investigation.status == NotebookStatus.ACTIVE
            and set(fields) == {"title"}
            and project_ids is None
        ):
            control = run.projection.get(_CONTROL_KEY, {})
            assert isinstance(control, dict)
            if control.get("manualTitleOverride") is not True:
                expected_version = locked_investigation.version
        updated = update_notebook_row(
            notebook=locked_investigation,
            expected_version=expected_version,
            fields=fields,
            project_ids=project_ids,
        )
        if run is not None and "title" in fields:
            control = run.projection.setdefault(_CONTROL_KEY, {})
            assert isinstance(control, dict)
            control.update(
                {
                    "manualTitleOverride": True,
                    "titleBuffer": updated.title,
                    "titleStarted": True,
                }
            )
            run.date_updated = timezone.now()
            run.save(update_fields=["projection", "date_updated"])
        return updated


def _manual_orchestration_source(source: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {
        "type": "manual",
        "projectScope": {"type": "investigation"},
        "seed": deepcopy(source.get("seed", {})),
    }
    for key in ("prompt", "timeRange"):
        if key in source:
            normalized[key] = deepcopy(source[key])
    return normalized


def create_agentic_manual_investigation(
    *,
    organization: Organization,
    creator: ActorId,
    title: str | None,
    source: dict[str, Any],
    project_ids: list[int],
    filters: dict[str, Any],
) -> tuple[Notebook, InvestigationOrchestrationRun]:
    _validate_creation_actor(organization=organization, creator=creator, project_ids=project_ids)
    return _create_agentic_investigation(
        organization=organization,
        creator=creator,
        title=title,
        source=source,
        orchestration_source=_manual_orchestration_source(source),
        project_ids=project_ids,
        filters=filters,
    )


def _breached_metric_orchestration_source(source: dict[str, Any]) -> dict[str, Any]:
    """Build internal orchestration context from Sentry's canonical metric snapshot."""

    snapshot = source["snapshot"]
    monitor = snapshot["monitor"]
    project = snapshot["project"]
    window = snapshot["analysisWindow"]
    conditions = monitor["conditions"]
    threshold = next(
        (
            condition.get("comparison")
            for condition in conditions
            if isinstance(condition, dict)
            and isinstance(condition.get("comparison"), int | float)
            and not isinstance(condition.get("comparison"), bool)
        ),
        None,
    )
    project_id = int(project["id"])
    breach_start = window["breachStart"]
    baseline_start = window["baselineStart"]
    end = window["end"]
    return {
        "type": "breached_metric",
        "metricIssueId": snapshot["groupId"],
        "openPeriodId": snapshot["openPeriodId"],
        "detectorId": monitor["id"],
        "monitorId": monitor["id"],
        "monitorName": monitor["name"],
        "metricQuery": monitor["query"],
        "projectIds": [project_id],
        "monitor": deepcopy(monitor),
        "project": deepcopy(project),
        "analysisWindow": deepcopy(window),
        "environment": monitor["environment"],
        "threshold": threshold,
        "thresholdDirection": monitor["direction"],
        "openPeriod": {"start": breach_start, "end": end},
        "baselinePeriod": {"start": baseline_start, "end": breach_start},
        "seed": {
            "groupTitle": snapshot["groupTitle"],
            "sentrySource": deepcopy(source),
        },
    }


def rebuild_orchestration_source(investigation: Notebook) -> dict[str, Any] | None:
    """The source Seer gets when the run starts, built again from the monitor as it is now.
    None if Sentry can no longer read the monitor.
    """

    if investigation.source_type == NotebookSourceType.MANUAL:
        return _manual_orchestration_source(investigation.source)
    source_ref = (
        int(investigation.source["ref"]["groupId"]),
        int(investigation.source["ref"]["openPeriodId"]),
    )
    # The access check ran when the investigation started, so allow the monitor's own project.
    project_id = int(investigation.source["snapshot"]["project"]["id"])
    resolved = resolve_breached_metric_sources(
        organization=investigation.organization,
        source_refs=[source_ref],
        accessible_project_ids={project_id},
    ).get(source_ref)
    if resolved is None:
        return None
    return _breached_metric_orchestration_source(resolved.source)


def agentic_breached_metric_source_key(source: dict[str, Any]) -> str:
    ref = source["ref"]
    return f"metric_open_period:{ref['groupId']}:{ref['openPeriodId']}"


def create_agentic_breached_metric_investigation(
    *,
    organization: Organization,
    creator: ActorId,
    title: str | None,
    resolved_source: BreachedMetricSource,
    project_ids: list[int],
    filters: dict[str, Any],
) -> tuple[Notebook, bool]:
    _validate_creation_actor(organization=organization, creator=creator, project_ids=project_ids)
    if resolved_source.project_id not in project_ids:
        raise NotebookValidationError({"projectIds": "The metric project must be selected."})
    normalized_source = resolved_source.source
    source_key = agentic_breached_metric_source_key(normalized_source)

    def create(revision: int) -> Notebook:
        investigation, _ = _create_agentic_investigation(
            organization=organization,
            creator=creator,
            title=title,
            source=normalized_source,
            orchestration_source=_breached_metric_orchestration_source(normalized_source),
            project_ids=project_ids,
            filters=filters,
            source_type=NotebookSourceType.METRIC_OPEN_PERIOD,
            source_key=source_key,
            source_revision=revision,
        )
        return investigation

    return get_or_create_source_notebook(
        organization=organization, source_key=source_key, create=create
    )


def _require_accessible_projects(
    project_ids: list[int], accessible_project_ids: AbstractSet[int]
) -> None:
    if not set(project_ids).issubset(accessible_project_ids):
        raise NotebookValidationError({"detail": "One or more projects are inaccessible."})


def start_investigation(
    *,
    organization: Organization,
    creator: Callable[[], ActorId],
    title: str | None,
    source: dict[str, Any],
    project_ids: list[int],
    accessible_project_ids: AbstractSet[int],
    filters: dict[str, Any],
) -> tuple[Notebook, bool]:
    """Start the engine for a validated source. The bool is False when an active metric
    investigation is reused.
    """
    # creator is resolved last so a bad source or project gets its 400/404 before a 403.
    if source["type"] == "metric_open_period":
        resolved_source = resolve_investigation_source(
            organization=organization,
            source=source,
            accessible_project_ids=accessible_project_ids,
        )
        requested_project_ids = sorted(set(project_ids) | {resolved_source.project_id})
        _require_accessible_projects(requested_project_ids, accessible_project_ids)
        return create_agentic_breached_metric_investigation(
            organization=organization,
            creator=creator(),
            title=title,
            resolved_source=resolved_source,
            project_ids=requested_project_ids,
            filters=filters,
        )
    _require_accessible_projects(project_ids, accessible_project_ids)
    investigation, _ = create_agentic_manual_investigation(
        organization=organization,
        creator=creator(),
        title=title,
        source=source,
        project_ids=project_ids,
        filters=filters,
    )
    return investigation, True


def _serialize_orchestration_run(run: InvestigationOrchestrationRun) -> dict[str, Any]:
    """Overlay projection JSON with the run's authoritative scalar fields."""

    projection = deepcopy(run.projection)
    projection.pop(_CONTROL_KEY, None)
    projection.update(
        {
            "runId": (
                str(run.seer_run.seer_run_state_id)
                if run.seer_run is not None and run.seer_run.seer_run_state_id is not None
                else None
            ),
            "investigationId": str(run.investigation_id),
            "workflowVersion": run.workflow_version,
            "generation": run.generation,
            "phase": run.phase,
            "status": run.status,
            "notebookRevision": run.notebook_revision,
            "heartbeatAt": run.heartbeat_at,
            "updatedAt": run.date_updated,
            # This must be fresh on every read, even when the stored projection has not changed.
            "serverTime": timezone.now(),
        }
    )
    report = projection["report"]
    assert isinstance(report, dict)
    report["notebookRevision"] = run.notebook_revision
    return projection


def get_orchestration_projection(investigation: Notebook) -> dict[str, Any]:
    try:
        run = InvestigationOrchestrationRun.objects.select_related("seer_run").get(
            investigation=investigation
        )
    except InvestigationOrchestrationRun.DoesNotExist:
        raise NotebookSourceNotFound
    return _serialize_orchestration_run(run)


def _command_acceptance(
    run: InvestigationOrchestrationRun,
    command: InvestigationOrchestrationCommand,
    *,
    duplicate: bool,
) -> AcceptedOrchestrationCommand:
    return AcceptedOrchestrationCommand(
        run_id=(
            run.seer_run.seer_run_state_id
            if run.seer_run is not None and run.seer_run.seer_run_state_id is not None
            else None
        ),
        request_id=command.request_id,
        duplicate=duplicate,
        workflow_version=run.workflow_version,
        status=command.status,
        error=command.error,
        projection=_serialize_orchestration_run(run),
    )


def accept_orchestration_command(
    *,
    investigation: Notebook,
    request_id: UUID,
    expected_workflow_version: int,
    command_type: str,
    payload: dict[str, Any],
    actor_id: int | None,
    service_account_id: int | None = None,
) -> AcceptedOrchestrationCommand:
    with transaction.atomic(using=router.db_for_write(InvestigationOrchestrationRun)):
        # Investigation-wide mutations lock the aggregate root before subordinate rows.
        try:
            locked_investigation = Notebook.objects.select_for_update().get(id=investigation.id)
        except Notebook.DoesNotExist:
            raise NotebookSourceNotFound
        if locked_investigation.status == NotebookStatus.ARCHIVED:
            raise NotebookValidationError(
                {"detail": "Archived investigations do not accept commands."}
            )
        try:
            run = InvestigationOrchestrationRun.objects.select_for_update().get(
                investigation=locked_investigation
            )
        except InvestigationOrchestrationRun.DoesNotExist:
            raise NotebookSourceNotFound

        internal = command_type in INTERNAL_COMMAND_TYPES
        existing = InvestigationOrchestrationCommand.objects.filter(
            orchestration_run=run, request_id=request_id
        ).first()
        if existing is not None:
            if (
                (not internal and existing.expected_workflow_version != expected_workflow_version)
                or existing.type != command_type
                or existing.payload != payload
            ):
                raise NotebookConflictError("Request ID was already used for a different command.")
            if run.seer_run_id is None and _is_run_retry(existing.type, existing.payload):
                _schedule_orchestration_create(run.id)
            elif (
                existing.status == InvestigationOrchestrationCommandStatus.FAILED
                and command_can_be_resent(existing.type, existing.error)
            ):
                _requeue_failed_command(run, existing)
                existing.refresh_from_db(fields=["status", "error"])
                schedule_orchestration_commands(run.id)
            elif existing.status in {
                InvestigationOrchestrationCommandStatus.ACCEPTED,
                InvestigationOrchestrationCommandStatus.DISPATCHED,
            }:
                schedule_orchestration_commands(run.id)
            return _command_acceptance(run, existing, duplicate=True)

        if not internal and run.workflow_version != expected_workflow_version:
            raise NotebookConflictError("Workflow version does not match.")

        _validate_command_target(
            run, request_id=request_id, command_type=command_type, payload=payload
        )

        if run.seer_run_id is None and _is_run_retry(command_type, payload):
            command = InvestigationOrchestrationCommand.objects.create(
                orchestration_run=run,
                request_id=request_id,
                actor_id=actor_id,
                requested_by_service_account_id=service_account_id,
                expected_workflow_version=expected_workflow_version,
                resulting_workflow_version=run.workflow_version,
                type=command_type,
                payload=payload,
                status=InvestigationOrchestrationCommandStatus.ACKNOWLEDGED,
            )
            _reset_create_dispatch_failure(run)
            run.date_updated = timezone.now()
            run.save(
                update_fields=[
                    "phase",
                    "status",
                    "projection",
                    "error",
                    "date_updated",
                ]
            )
            _schedule_orchestration_create(run.id)
            return _command_acceptance(run, command, duplicate=False)

        resulting_version = run.workflow_version if internal else run.workflow_version + 1
        command = InvestigationOrchestrationCommand.objects.create(
            orchestration_run=run,
            request_id=request_id,
            actor_id=actor_id,
            requested_by_service_account_id=service_account_id,
            expected_workflow_version=expected_workflow_version,
            resulting_workflow_version=resulting_version,
            type=command_type,
            payload=deepcopy(payload),
        )
        projection = deepcopy(run.projection)
        projection["workflowVersion"] = resulting_version
        run.workflow_version = resulting_version
        run.projection = projection
        run.date_updated = timezone.now()
        run.save(
            update_fields=[
                "workflow_version",
                "projection",
                "date_updated",
            ]
        )
        schedule_orchestration_commands(run.id)
        return _command_acceptance(run, command, duplicate=False)
