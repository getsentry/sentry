from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from functools import partial
from typing import Any
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
from sentry.seer.workflows import state as workflow_state
from sentry.seer.workflows.schemas import WorkflowResult, WorkflowResultError, WorkflowRunExtras
from sentry.utils import json

logger = logging.getLogger(__name__)
TERMINAL_STATUSES = {"complete", "partial", "failed"}


@dataclass
class SeerWorkflowRunLifecycle:
    """The lifecycle of one configurable automation invocation."""

    run: SeerWorkflowRun

    def __post_init__(self) -> None:
        workflow_state.read_run_state(self.run)

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

    @property
    def state(self) -> workflow_state.RunState:
        return workflow_state.read_run_state(self.run)

    def start(self) -> SeerWorkflowRun:
        """Mark the start of orchestration, including work selection."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            state, _ = self._load_locked()
            if not isinstance(state, workflow_state.Queued):
                raise workflow_state.InvalidWorkflowTransition(
                    "Only queued workflow runs can start"
                )
            self.run.status = SeerWorkflowRunStatus.RUNNING
            self.run.save(update_fields=["status", "date_updated"])
        return self.run

    def create_execution(
        self, *, extras: SeerWorkflowExecutionExtras | None = None
    ) -> SeerWorkflowRunExecution:
        """Plan all executions before dispatching any of them."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            state, executions = self._load_locked()
            if not isinstance(state, workflow_state.Running):
                raise workflow_state.InvalidWorkflowTransition(
                    "Executions can only be added to a running workflow"
                )
            for _, execution_state in executions.values():
                if not isinstance(execution_state, workflow_state.Queued):
                    raise workflow_state.InvalidWorkflowTransition(
                        "The execution plan cannot change after work starts"
                    )
            execution = SeerWorkflowRunExecution.objects.create(
                run=self.run,
                status=SeerWorkflowExecutionStatus.QUEUED,
                extras=json.loads((extras or SeerWorkflowExecutionExtras()).json()),
            )
            workflow_state.read_execution_state(execution)
        return execution

    def start_execution(self, execution_id: int) -> SeerWorkflowRunExecution:
        """Mark an execution running when its work starts."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            state, executions = self._load_locked()
            execution, execution_state = self._get_execution(executions, execution_id)
            if not isinstance(state, workflow_state.Running):
                raise workflow_state.InvalidWorkflowTransition(
                    "Executions can only start while their workflow is running"
                )
            if not isinstance(execution_state, workflow_state.Queued):
                raise workflow_state.InvalidWorkflowTransition("Only queued executions can start")
            execution.status = SeerWorkflowExecutionStatus.RUNNING
            execution.save(update_fields=["status", "date_updated"])
        return execution

    def complete(self, *, error: WorkflowRunError | None = None) -> SeerWorkflowRun:
        """Finish a run without executions; exact completion retries are allowed."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            state, executions = self._load_locked()
            if executions:
                raise workflow_state.InvalidWorkflowTransition(
                    "Finish the run's executions with complete_execution"
                )
            if isinstance(state, workflow_state.Complete) and error is None:
                return self.run
            if isinstance(state, workflow_state.Failed) and state.error == error:
                return self.run
            if not isinstance(state, workflow_state.Queued | workflow_state.Running):
                raise workflow_state.InvalidWorkflowTransition(
                    "Run completion conflicts with its state"
                )
            completed_at = timezone.now()
            self._finish(
                workflow_state.Failed(completed_at, error)
                if error
                else workflow_state.Complete(completed_at)
            )
        return self.run

    def reject(self, *, error: WorkflowRunError) -> SeerWorkflowRun:
        """Reject a queued run; exact rejection retries are allowed."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            state, executions = self._load_locked()
            if isinstance(state, workflow_state.Rejected) and state.error == error:
                return self.run
            if not isinstance(state, workflow_state.Queued) or executions:
                raise workflow_state.InvalidWorkflowTransition(
                    "Only queued runs without executions can be rejected"
                )
            self._finish(workflow_state.Rejected(timezone.now(), error))
        return self.run

    def complete_execution(
        self, execution_id: int, *, error: WorkflowRunError | None = None
    ) -> SeerWorkflowRunExecution:
        """Finish one execution; finalize the run after every execution finishes.

        Execution errors stay on the execution; only status and completion time roll up.
        Lock the parent before reading executions so simultaneous callbacks cannot
        both miss the other execution's completion.
        """
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            run_state, executions = self._load_locked()
            execution, state = self._get_execution(executions, execution_id)
            if isinstance(state, workflow_state.Complete) and error is None:
                return execution
            if isinstance(state, workflow_state.Failed) and state.error == error:
                return execution
            if not isinstance(state, workflow_state.Queued | workflow_state.Running):
                raise workflow_state.InvalidWorkflowTransition(
                    "Execution completion conflicts with its state"
                )
            if not isinstance(run_state, workflow_state.Running):
                raise workflow_state.InvalidWorkflowTransition(
                    "Executions can only finish while their workflow is running"
                )
            other_states = [
                other_state
                for other_id, (_, other_state) in executions.items()
                if other_id != execution_id
            ]
            completed_at = timezone.now()
            outcome = (
                workflow_state.Failed(completed_at, error)
                if error
                else workflow_state.Complete(completed_at)
            )
            execution.status = outcome.status
            execution_extras = SeerWorkflowExecutionExtras.parse_obj(execution.extras)
            execution_extras.error = (
                outcome.error if isinstance(outcome, workflow_state.Failed) else None
            )
            execution.extras = json.loads(execution_extras.json())
            execution.date_completed = outcome.date_completed
            execution.save(update_fields=["status", "extras", "date_completed", "date_updated"])

            unfinished = any(
                isinstance(other, workflow_state.Queued | workflow_state.Running)
                for other in other_states
            )
            if not unfinished:
                failed = error is not None or any(
                    isinstance(other, workflow_state.Failed) for other in other_states
                )
                run_outcome = (
                    workflow_state.ExecutionsFailed(outcome.date_completed)
                    if failed
                    else workflow_state.Complete(outcome.date_completed)
                )
                self.run.status = run_outcome.status
                self.run.date_completed = run_outcome.date_completed
                self.run.save(update_fields=["status", "date_completed", "date_updated"])
        return execution

    def _load_locked(
        self,
    ) -> tuple[
        workflow_state.RunState,
        dict[int, tuple[SeerWorkflowRunExecution, workflow_state.ExecutionState]],
    ]:
        self.run = SeerWorkflowRun.objects.select_for_update().get(
            id=self.run.id, organization_id=self.run.organization_id, status__isnull=False
        )
        state = workflow_state.read_run_state(self.run)
        executions = {
            execution.id: (execution, workflow_state.read_execution_state(execution))
            for execution in self.run.executions.all()
        }
        workflow_state.validate_run_executions(
            state, [execution_state for _, execution_state in executions.values()]
        )
        return state, executions

    def _get_execution(
        self,
        executions: Mapping[int, tuple[SeerWorkflowRunExecution, workflow_state.ExecutionState]],
        execution_id: int,
    ) -> tuple[SeerWorkflowRunExecution, workflow_state.ExecutionState]:
        try:
            return executions[execution_id]
        except KeyError as exc:
            raise SeerWorkflowRunExecution.DoesNotExist from exc

    def _finish(
        self, state: workflow_state.Complete | workflow_state.Failed | workflow_state.Rejected
    ) -> None:
        extras = self.extras
        extras.error = None if isinstance(state, workflow_state.Complete) else state.error
        self.run.status = state.status
        self.run.extras = json.loads(extras.json())
        self.run.date_completed = state.date_completed
        self.run.save(update_fields=["status", "extras", "date_completed", "date_updated"])


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
