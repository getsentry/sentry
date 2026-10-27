from __future__ import annotations

import logging
from collections.abc import Callable, Collection, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any, Literal, assert_never
from uuid import UUID

from django.db import router, transaction
from django.utils import timezone

from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunMirrorStatus
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionExtras,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunExtras,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
    WorkflowRunError,
)
from sentry.seer.workflows.schemas import WorkflowResult, WorkflowResultError, WorkflowRunExtras
from sentry.utils import json

logger = logging.getLogger(__name__)
TERMINAL_STATUSES = {"complete", "partial", "failed"}


class InvalidWorkflowState(ValueError):
    pass


class InvalidWorkflowTransition(ValueError):
    pass


@dataclass
class SeerWorkflowRunLifecycle:
    run: SeerWorkflowRun

    def __post_init__(self) -> None:
        self._validate_run()

    @classmethod
    def get(cls, *, organization_id: int, run_id: int) -> SeerWorkflowRunLifecycle:
        return cls(
            SeerWorkflowRun.objects.get(
                id=run_id, organization_id=organization_id, status__isnull=False
            )
        )

    @property
    def extras(self) -> SeerWorkflowRunExtras:
        return SeerWorkflowRunExtras.parse_obj(self.run.extras)

    def start(self) -> SeerWorkflowRun:
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            status, _ = self._load_locked()
            if status != SeerWorkflowRunStatus.QUEUED:
                raise InvalidWorkflowTransition("Only queued workflow runs can start")
            self.run.status = SeerWorkflowRunStatus.RUNNING
            self.run.save(update_fields=["status", "date_updated"])
        return self.run

    def create_executions(
        self, plan: Sequence[SeerWorkflowExecutionExtras]
    ) -> list[SeerWorkflowRunExecution]:
        """An empty plan completes the run."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            status, existing = self._load_locked()
            if not plan and status == SeerWorkflowRunStatus.COMPLETE and not existing:
                return []
            if status != SeerWorkflowRunStatus.RUNNING:
                raise InvalidWorkflowTransition(
                    "Executions can only be added to a running workflow"
                )
            if existing:
                raise InvalidWorkflowTransition("An execution plan already exists")
            if not plan:
                self._finish(
                    SeerWorkflowRunStatus.COMPLETE, error=None, completed_at=timezone.now()
                )
                return []
            executions = [
                SeerWorkflowRunExecution(
                    run=self.run,
                    status=SeerWorkflowExecutionStatus.QUEUED,
                    extras=json.loads(extras.json()),
                )
                for extras in plan
            ]
            for execution in executions:
                self._validate_execution(execution)
            return SeerWorkflowRunExecution.objects.bulk_create(executions)

    def start_execution(self, execution_id: int) -> SeerWorkflowRunExecution:
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            status, executions = self._load_locked()
            execution = self._get_execution(executions, execution_id)
            if status != SeerWorkflowRunStatus.RUNNING:
                raise InvalidWorkflowTransition(
                    "Executions can only start while their workflow is running"
                )
            if execution.status != SeerWorkflowExecutionStatus.QUEUED:
                raise InvalidWorkflowTransition("Only queued executions can start")
            execution.status = SeerWorkflowExecutionStatus.RUNNING
            execution.save(update_fields=["status", "date_updated"])
        return execution

    def fail(self, error: WorkflowRunError) -> SeerWorkflowRun:
        """Exact failure retries are allowed."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            status, executions = self._load_locked()
            if executions:
                raise InvalidWorkflowTransition("Fail the run's executions with complete_execution")
            match status:
                case SeerWorkflowRunStatus.QUEUED | SeerWorkflowRunStatus.RUNNING:
                    self._finish(
                        SeerWorkflowRunStatus.FAILED, error=error, completed_at=timezone.now()
                    )
                case SeerWorkflowRunStatus.FAILED if self.extras.error == error:
                    return self.run
                case _:
                    raise InvalidWorkflowTransition("Run failure conflicts with its state")
        return self.run

    def reject(self, *, error: WorkflowRunError) -> SeerWorkflowRun:
        """Exact rejection retries are allowed."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            status, _ = self._load_locked()
            if status == SeerWorkflowRunStatus.REJECTED and self.extras.error == error:
                return self.run
            if status != SeerWorkflowRunStatus.QUEUED:
                raise InvalidWorkflowTransition(
                    "Only queued runs without executions can be rejected"
                )
            self._finish(SeerWorkflowRunStatus.REJECTED, error=error, completed_at=timezone.now())
        return self.run

    def complete_execution(
        self, execution_id: int, *, error: WorkflowRunError | None = None
    ) -> SeerWorkflowRunExecution:
        """Lock the parent so concurrent callbacks observe each other's completions."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            status, executions = self._load_locked()
            execution = self._get_execution(executions, execution_id)
            execution_extras = SeerWorkflowExecutionExtras.parse_obj(execution.extras)
            if execution.status == SeerWorkflowExecutionStatus.COMPLETE and error is None:
                return execution
            if (
                execution.status == SeerWorkflowExecutionStatus.FAILED
                and execution_extras.error == error
            ):
                return execution
            if execution.status not in {
                SeerWorkflowExecutionStatus.QUEUED,
                SeerWorkflowExecutionStatus.RUNNING,
            }:
                raise InvalidWorkflowTransition("Execution completion conflicts with its state")
            if status != SeerWorkflowRunStatus.RUNNING:
                raise InvalidWorkflowTransition(
                    "Executions can only finish while their workflow is running"
                )
            completed_at = timezone.now()
            execution.status = (
                SeerWorkflowExecutionStatus.FAILED
                if error
                else SeerWorkflowExecutionStatus.COMPLETE
            )
            execution_extras.error = error
            execution.extras = json.loads(execution_extras.json())
            execution.date_completed = completed_at
            execution.save(update_fields=["status", "extras", "date_completed", "date_updated"])

            unfinished = any(
                other.status
                in {SeerWorkflowExecutionStatus.QUEUED, SeerWorkflowExecutionStatus.RUNNING}
                for other in executions.values()
            )
            if not unfinished:
                failed = any(
                    other.status == SeerWorkflowExecutionStatus.FAILED
                    for other in executions.values()
                )
                self.run.status = (
                    SeerWorkflowRunStatus.FAILED if failed else SeerWorkflowRunStatus.COMPLETE
                )
                self.run.date_completed = completed_at
                self.run.save(update_fields=["status", "date_completed", "date_updated"])
        return execution

    def _load_locked(
        self,
    ) -> tuple[
        SeerWorkflowRunStatus,
        dict[int, SeerWorkflowRunExecution],
    ]:
        self.run = SeerWorkflowRun.objects.select_for_update().get(
            id=self.run.id, organization_id=self.run.organization_id, status__isnull=False
        )
        status = self._validate_run()
        executions = {execution.id: execution for execution in self.run.executions.all()}
        for execution in executions.values():
            self._validate_execution(execution)
        self._validate_executions(status, executions.values())
        return status, executions

    def _validate_run(self) -> SeerWorkflowRunStatus:
        if self.run.status is None:
            raise InvalidWorkflowState("Shared workflow runs require a status")
        try:
            status = SeerWorkflowRunStatus(self.run.status)
            error = self.extras.error
        except ValueError as exc:
            raise InvalidWorkflowState("Invalid workflow run status or metadata") from exc
        _validate_completion(status, self.run.date_completed, error)
        if status == SeerWorkflowRunStatus.REJECTED and error is None:
            raise InvalidWorkflowState("Rejected runs require an error")
        return status

    def _validate_execution(self, execution: SeerWorkflowRunExecution) -> None:
        if execution.status is None:
            raise InvalidWorkflowState("Shared workflow executions require a status")
        try:
            status = SeerWorkflowExecutionStatus(execution.status)
            extras = SeerWorkflowExecutionExtras.parse_obj(execution.extras)
        except ValueError as exc:
            raise InvalidWorkflowState("Invalid workflow execution status or metadata") from exc
        _validate_completion(status, execution.date_completed, extras.error)
        if status == SeerWorkflowExecutionStatus.FAILED and extras.error is None:
            raise InvalidWorkflowState("Failed executions require an error")

    def _validate_executions(
        self, status: SeerWorkflowRunStatus, executions: Collection[SeerWorkflowRunExecution]
    ) -> None:
        match status:
            case SeerWorkflowRunStatus.QUEUED | SeerWorkflowRunStatus.REJECTED:
                if executions:
                    raise InvalidWorkflowState("Queued or rejected runs cannot have executions")
            case SeerWorkflowRunStatus.RUNNING:
                if executions and all(
                    execution.status
                    in {SeerWorkflowExecutionStatus.COMPLETE, SeerWorkflowExecutionStatus.FAILED}
                    for execution in executions
                ):
                    raise InvalidWorkflowState(
                        "A run with only finished executions must be terminal"
                    )
            case SeerWorkflowRunStatus.COMPLETE:
                if any(
                    execution.status != SeerWorkflowExecutionStatus.COMPLETE
                    for execution in executions
                ):
                    raise InvalidWorkflowState(
                        "A completed run cannot have unfinished or failed executions"
                    )
            case SeerWorkflowRunStatus.FAILED:
                if self.extras.error is not None:
                    if executions:
                        raise InvalidWorkflowState(
                            "Orchestration-failed runs cannot have executions"
                        )
                elif any(
                    execution.status
                    in {SeerWorkflowExecutionStatus.QUEUED, SeerWorkflowExecutionStatus.RUNNING}
                    for execution in executions
                ) or not any(
                    execution.status == SeerWorkflowExecutionStatus.FAILED
                    for execution in executions
                ):
                    raise InvalidWorkflowState(
                        "An execution-failed run requires finished executions and a failure"
                    )
            case _:
                assert_never(status)

    def _get_execution(
        self,
        executions: Mapping[int, SeerWorkflowRunExecution],
        execution_id: int,
    ) -> SeerWorkflowRunExecution:
        try:
            return executions[execution_id]
        except KeyError as exc:
            raise SeerWorkflowRunExecution.DoesNotExist from exc

    def _finish(
        self,
        status: Literal[
            SeerWorkflowRunStatus.COMPLETE,
            SeerWorkflowRunStatus.FAILED,
            SeerWorkflowRunStatus.REJECTED,
        ],
        *,
        error: WorkflowRunError | None,
        completed_at: datetime,
    ) -> None:
        extras = self.extras
        extras.error = error
        self.run.status = status
        self.run.extras = json.loads(extras.json())
        self.run.date_completed = completed_at
        self.run.save(update_fields=["status", "extras", "date_completed", "date_updated"])


def _validate_completion(
    status: str, completed_at: datetime | None, error: WorkflowRunError | None
) -> None:
    if status in {"queued", "running"}:
        if completed_at is not None or error is not None:
            raise InvalidWorkflowState("Active workflows cannot have a completion time or error")
    elif completed_at is None:
        raise InvalidWorkflowState("Terminal workflows require a completion time")
    elif status == "complete" and error is not None:
        raise InvalidWorkflowState("Completed workflows cannot have an error")


def create_workflow_run(
    client: SeerAgentClient,
    *,
    strategy: SeerWorkflowStrategy,
    feature_id: str,
    payload: dict[str, Any],
    title: str,
    extras: Mapping[str, Any] | None = None,
) -> SeerWorkflowRun:
    """Atomically create a workflow with one execution and enqueue its dispatch."""
    run = client.start_feature_run(
        feature_id=feature_id,
        payload=payload,
        title=title,
        flush=False,
        extras={**(extras or {}), "status": "running", "error": None},
        referrer=feature_id,
        on_run_created=partial(_create_workflow_run, strategy=strategy),
    )
    return run.workflow_execution.run


def _create_workflow_run(seer_run: SeerRun, *, strategy: SeerWorkflowStrategy) -> None:
    config = SeerWorkflowConfig.get_or_create_for_strategy(seer_run.organization_id, strategy)
    run = SeerWorkflowRun.objects.create(
        organization_id=seer_run.organization_id, workflow_config=config
    )
    SeerWorkflowRunExecution.objects.create(run=run, seer_run=seer_run)


def deliver_workflow_result(
    *,
    feature_id: str,
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    parse_result: Callable[[dict[str, Any], SeerAgentRun], WorkflowResult],
) -> None:
    log_extra = {
        "feature_id": feature_id,
        "organization_id": organization_id,
        "run_uuid": str(run_uuid),
        "status": status,
    }
    logger.info("seer.workflow.delivery.received", extra=log_extra)
    agent_run = (
        SeerAgentRun.objects.select_related("run__organization")
        .filter(run__organization_id=organization_id, source=feature_id, run__uuid=run_uuid)
        .first()
    )
    if agent_run is None:
        logger.warning("seer.workflow.delivery.missing_run", extra=log_extra)
        return
    if agent_run.extras.get("status") in TERMINAL_STATUSES:
        logger.info("seer.workflow.delivery.already_finished", extra=log_extra)
        return
    finish = partial(
        finish_workflow_run,
        agent_run.run_id,
        organization_id=organization_id,
        feature_id=feature_id,
    )
    if status != "completed" or result is None:
        logger.warning("seer.workflow.delivery.failed", extra={**log_extra, "error": error})
        finish(error="Seer could not complete this workflow.")
        return
    try:
        parsed = parse_result(result, agent_run)
    except WorkflowResultError as exc:
        logger.exception("seer.workflow.result_processing_failed", extra=log_extra)
        finish(error=str(exc))
        return
    except Exception:
        logger.exception("seer.workflow.invalid_output", extra=log_extra)
        finish(error="Seer returned results that could not be loaded.")
        return
    finish(result=parsed)


def finish_workflow_run(
    run_id: int,
    *,
    organization_id: int,
    feature_id: str,
    result: WorkflowResult | None = None,
    error: str | None = None,
) -> None:
    """Finalize the single-execution workflow created by create_workflow_run."""
    with transaction.atomic(router.db_for_write(SeerAgentRun)):
        agent_run = (
            SeerAgentRun.objects.select_for_update(of=("self",))
            .filter(run_id=run_id, run__organization_id=organization_id, source=feature_id)
            .first()
        )
        if agent_run is None or agent_run.extras.get("status") in TERMINAL_STATUSES:
            return
        extras: WorkflowRunExtras = {
            "status": "failed" if error else result.status if result else "complete",
            "error": error,
        }
        agent_run.update(extras={**agent_run.extras, **(result.extras if result else {}), **extras})
        SeerWorkflowRun.objects.filter(
            organization_id=organization_id,
            executions__seer_run_id=run_id,
            date_completed__isnull=True,
        ).update(date_completed=timezone.now())
    logger.info(
        "seer.workflow.run.finished",
        extra={
            "feature_id": feature_id,
            "run_id": run_id,
            "organization_id": organization_id,
            "status": extras["status"],
            "error": error,
        },
    )


def get_workflow_run_status(agent_run: SeerAgentRun) -> WorkflowRunExtras:
    extras: WorkflowRunExtras = agent_run.extras
    if (
        extras["status"] not in TERMINAL_STATUSES
        and agent_run.run.mirror_status == SeerRunMirrorStatus.FAILED
    ):
        return {
            "status": "failed",
            "error": "Seer could not start this workflow.",
        }
    return {
        "status": extras["status"],
        "error": extras["error"],
    }
