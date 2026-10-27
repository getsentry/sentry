from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar, Literal, assert_never

from sentry.seer.models.workflow import (
    SeerWorkflowExecutionExtras,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunExtras,
    SeerWorkflowRunStatus,
    WorkflowRunError,
)


class InvalidWorkflowState(ValueError):
    """Persisted fields do not describe a valid lifecycle state."""


class InvalidWorkflowTransition(ValueError):
    """A lifecycle command is not allowed in the current state."""


@dataclass(frozen=True)
class Queued:
    status: ClassVar[Literal["queued"]] = "queued"


@dataclass(frozen=True)
class Running:
    status: ClassVar[Literal["running"]] = "running"


@dataclass(frozen=True)
class Complete:
    date_completed: datetime
    status: ClassVar[Literal["complete"]] = "complete"


@dataclass(frozen=True)
class Failed:
    date_completed: datetime
    error: WorkflowRunError
    status: ClassVar[Literal["failed"]] = "failed"


@dataclass(frozen=True)
class ExecutionsFailed:
    date_completed: datetime
    status: ClassVar[Literal["failed"]] = "failed"


@dataclass(frozen=True)
class Rejected:
    date_completed: datetime
    error: WorkflowRunError
    status: ClassVar[Literal["rejected"]] = "rejected"


type RunState = Queued | Running | Complete | Failed | ExecutionsFailed | Rejected
type ExecutionState = Queued | Running | Complete | Failed


def read_run_state(run: SeerWorkflowRun) -> RunState:
    if run.status is None:
        raise InvalidWorkflowState("Shared workflow runs require a status")
    try:
        status = SeerWorkflowRunStatus(run.status)
        error = SeerWorkflowRunExtras.parse_obj(run.extras).error
    except ValueError as exc:
        raise InvalidWorkflowState("Invalid workflow run status or metadata") from exc
    active = _read_active_state(status, run.date_completed, error)
    if active is not None:
        return active
    completed_at = _require_completion_time(run.date_completed)
    match status:
        case SeerWorkflowRunStatus.COMPLETE if error is None:
            return Complete(completed_at)
        case SeerWorkflowRunStatus.FAILED:
            return Failed(completed_at, error) if error else ExecutionsFailed(completed_at)
        case SeerWorkflowRunStatus.REJECTED:
            return Rejected(completed_at, _require_error(error))
    raise InvalidWorkflowState("Invalid workflow run status, completion time, or error")


def read_execution_state(execution: SeerWorkflowRunExecution) -> ExecutionState:
    if execution.status is None:
        raise InvalidWorkflowState("Shared workflow executions require a status")
    try:
        status = SeerWorkflowExecutionStatus(execution.status)
        error = SeerWorkflowExecutionExtras.parse_obj(execution.extras).error
    except ValueError as exc:
        raise InvalidWorkflowState("Invalid workflow execution status or metadata") from exc
    active = _read_active_state(status, execution.date_completed, error)
    if active is not None:
        return active
    completed_at = _require_completion_time(execution.date_completed)
    match status:
        case SeerWorkflowExecutionStatus.COMPLETE if error is None:
            return Complete(completed_at)
        case SeerWorkflowExecutionStatus.FAILED:
            return Failed(completed_at, _require_error(error))
    raise InvalidWorkflowState("Invalid workflow execution status, completion time, or error")


def validate_run_executions(state: RunState, executions: Sequence[ExecutionState]) -> None:
    if isinstance(state, Queued | Failed | Rejected):
        if executions:
            raise InvalidWorkflowState(
                "Queued, rejected, or orchestration-failed runs cannot have executions"
            )
        return
    if isinstance(state, Running):
        if executions and all(isinstance(execution, Complete | Failed) for execution in executions):
            raise InvalidWorkflowState("A run with only finished executions must be terminal")
        return
    if isinstance(state, Complete):
        if any(not isinstance(execution, Complete) for execution in executions):
            raise InvalidWorkflowState(
                "A completed run cannot have unfinished or failed executions"
            )
        return
    if isinstance(state, ExecutionsFailed):
        if any(isinstance(execution, Queued | Running) for execution in executions) or not any(
            isinstance(execution, Failed) for execution in executions
        ):
            raise InvalidWorkflowState(
                "An execution-failed run requires finished executions and a failure"
            )
        return
    assert_never(state)


def _read_active_state(
    status: str, completed_at: datetime | None, error: WorkflowRunError | None
) -> Queued | Running | None:
    if status not in {"queued", "running"}:
        return None
    if completed_at is not None or error is not None:
        raise InvalidWorkflowState("Active workflows cannot have a completion time or error")
    return Queued() if status == "queued" else Running()


def _require_completion_time(completed_at: datetime | None) -> datetime:
    if completed_at is None:
        raise InvalidWorkflowState("Terminal workflows require a completion time")
    return completed_at


def _require_error(error: WorkflowRunError | None) -> WorkflowRunError:
    if error is None:
        raise InvalidWorkflowState("Failed executions and rejected runs require an error")
    return error
