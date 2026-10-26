from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
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
from sentry.seer.workflows.schemas import WorkflowResult, WorkflowResultError, WorkflowRunExtras
from sentry.utils import json

logger = logging.getLogger(__name__)
TERMINAL_STATUSES = {"complete", "partial", "failed"}


@dataclass
class WorkflowRun:
    """The lifecycle of one configurable automation invocation."""

    run: SeerWorkflowRun

    @classmethod
    def get(cls, *, organization_id: int, run_id: int) -> WorkflowRun:
        return cls(
            SeerWorkflowRun.objects.get(
                id=run_id, organization_id=organization_id, status__isnull=False
            )
        )

    @property
    def extras(self) -> SeerWorkflowRunExtras:
        return SeerWorkflowRunExtras.parse_obj(self.run.extras)

    def start(self) -> SeerWorkflowRun:
        """Mark the start of orchestration, including work selection."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            self.run = self._get_locked_run()
            if self.run.status == SeerWorkflowRunStatus.QUEUED:
                self.run.status = SeerWorkflowRunStatus.RUNNING
                self.run.save(update_fields=["status", "date_updated"])
        return self.run

    def create_execution(
        self, *, extras: SeerWorkflowExecutionExtras | None = None
    ) -> SeerWorkflowRunExecution:
        """Plan all executions before dispatching any of them."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            self.run = self._get_locked_run()
            if self.run.status != SeerWorkflowRunStatus.RUNNING:
                raise ValueError("Executions can only be added to a running workflow")
            execution = SeerWorkflowRunExecution.objects.create(
                run=self.run,
                status=SeerWorkflowExecutionStatus.QUEUED,
                extras=json.loads((extras or SeerWorkflowExecutionExtras()).json()),
            )
        return execution

    def start_execution(self, execution_id: int) -> SeerWorkflowRunExecution:
        """Mark an execution running when its work starts."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            self.run = self._get_locked_run()
            execution = self.run.executions.get(id=execution_id)
            if execution.status == SeerWorkflowExecutionStatus.QUEUED:
                execution.status = SeerWorkflowExecutionStatus.RUNNING
                execution.save(update_fields=["status", "date_updated"])
        return execution

    def complete(self, *, error: WorkflowRunError | None = None) -> SeerWorkflowRun:
        """Finish work selection with an error or a successful no-work result."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            self.run = self._get_locked_run()
            if self.run.date_completed is not None:
                return self.run
            if self.run.executions.exists():
                raise ValueError("Finish the run's executions with complete_execution")
            self._finish(
                SeerWorkflowRunStatus.FAILED if error else SeerWorkflowRunStatus.COMPLETE,
                error=error,
                completed_at=timezone.now(),
            )
        return self.run

    def reject(self, *, error: WorkflowRunError) -> SeerWorkflowRun:
        """Record a terminal admission rejection without creating executions."""
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            self.run = self._get_locked_run()
            if self.run.date_completed is not None:
                return self.run
            if self.run.status != SeerWorkflowRunStatus.QUEUED or self.run.executions.exists():
                raise ValueError("Only queued runs without executions can be rejected")
            self._finish(SeerWorkflowRunStatus.REJECTED, error=error, completed_at=timezone.now())
        return self.run

    def complete_execution(
        self, execution_id: int, *, error: WorkflowRunError | None = None
    ) -> SeerWorkflowRunExecution:
        """Finish one execution; finalize the run after every execution finishes.

        Lock the parent before reading executions so simultaneous callbacks cannot
        both miss the other execution's completion.
        """
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            self.run = self._get_locked_run()
            execution = self.run.executions.get(id=execution_id)
            if execution.date_completed is not None:
                return execution
            execution.status = (
                SeerWorkflowExecutionStatus.FAILED
                if error
                else SeerWorkflowExecutionStatus.COMPLETE
            )
            execution_extras = SeerWorkflowExecutionExtras.parse_obj(execution.extras)
            execution_extras.error = error
            execution.extras = json.loads(execution_extras.json())
            execution.date_completed = timezone.now()
            execution.save(update_fields=["status", "extras", "date_completed", "date_updated"])

            unfinished = self.run.executions.exclude(
                status__in=[
                    SeerWorkflowExecutionStatus.COMPLETE,
                    SeerWorkflowExecutionStatus.FAILED,
                ]
            ).exists()
            if self.run.date_completed is None and not unfinished:
                failed = self.run.executions.filter(
                    status=SeerWorkflowExecutionStatus.FAILED
                ).first()
                self._finish(
                    SeerWorkflowRunStatus.FAILED if failed else SeerWorkflowRunStatus.COMPLETE,
                    error=SeerWorkflowExecutionExtras.parse_obj(failed.extras).error
                    if failed
                    else None,
                    completed_at=execution.date_completed,
                )
        return execution

    def _get_locked_run(self) -> SeerWorkflowRun:
        return SeerWorkflowRun.objects.select_for_update().get(
            id=self.run.id, organization_id=self.run.organization_id, status__isnull=False
        )

    def _finish(
        self,
        status: SeerWorkflowRunStatus,
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
