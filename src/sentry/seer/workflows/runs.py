from __future__ import annotations

import logging
from collections.abc import Callable, Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from functools import partial
from typing import Any, Literal
from uuid import UUID

from django.db import router, transaction
from django.db.models import QuerySet
from django.utils import timezone
from pydantic import ValidationError

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


class InvalidWorkflowTransition(ValueError):
    pass


@dataclass(frozen=True, kw_only=True)
class SeerWorkflowRunLifecycle:
    """Apply each transition to fresh state under the parent run's row lock.

    Returned models do not carry a lock or refresh automatically. Lifecycle changes
    should go through these methods, including changes to the run's executions.
    """

    run_id: int
    organization_id: int

    def get_run(self) -> SeerWorkflowRun:
        """Fetch the run without acquiring a lock."""
        return self._run_queryset().get()

    @property
    def extras(self) -> SeerWorkflowRunExtras:
        return self.parse_extras(SeerWorkflowRunExtras)

    def parse_extras[Extras: SeerWorkflowRunExtras](self, extras_type: type[Extras]) -> Extras:
        return self._parse_extras(self.get_run(), extras_type)

    def start(self) -> SeerWorkflowRun:
        with self._lock_run() as run:
            if run.status != SeerWorkflowRunStatus.QUEUED:
                raise InvalidWorkflowTransition("Only queued workflow runs can start")
            run.status = SeerWorkflowRunStatus.RUNNING
            run.save(update_fields=["status", "date_updated"])
        return run

    def create_executions(
        self, plan: Sequence[SeerWorkflowExecutionExtras]
    ) -> list[SeerWorkflowRunExecution]:
        """An empty plan completes the run."""
        with self._lock_run() as run:
            existing = run.executions.exists()
            if not plan and run.status == SeerWorkflowRunStatus.COMPLETE and not existing:
                return []
            if run.status != SeerWorkflowRunStatus.RUNNING:
                raise InvalidWorkflowTransition(
                    "Executions can only be added to a running workflow"
                )
            if existing:
                raise InvalidWorkflowTransition("An execution plan already exists")
            if not plan:
                self._finish(run, SeerWorkflowRunStatus.COMPLETE)
                return []
            executions = [
                SeerWorkflowRunExecution(
                    run=run,
                    status=SeerWorkflowExecutionStatus.QUEUED,
                    extras=json.loads(extras.json()),
                )
                for extras in plan
            ]
            return SeerWorkflowRunExecution.objects.bulk_create(executions)

    def start_execution(self, execution_id: int) -> SeerWorkflowRunExecution:
        with self._lock_run() as run:
            execution = run.executions.get(id=execution_id)
            if run.status != SeerWorkflowRunStatus.RUNNING:
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
        with self._lock_run() as run:
            if run.executions.exists():
                raise InvalidWorkflowTransition("Fail the run's executions with complete_execution")
            if (
                run.status == SeerWorkflowRunStatus.FAILED
                and self._parse_extras(run, SeerWorkflowRunExtras).error == error
            ):
                return run
            if run.status not in {SeerWorkflowRunStatus.QUEUED, SeerWorkflowRunStatus.RUNNING}:
                raise InvalidWorkflowTransition("Run failure conflicts with its state")
            self._finish(run, SeerWorkflowRunStatus.FAILED, error=error)
        return run

    def reject(self, *, error: WorkflowRunError) -> SeerWorkflowRun:
        """Exact rejection retries are allowed."""
        with self._lock_run() as run:
            if (
                run.status == SeerWorkflowRunStatus.REJECTED
                and self._parse_extras(run, SeerWorkflowRunExtras).error == error
            ):
                return run
            if run.status != SeerWorkflowRunStatus.QUEUED:
                raise InvalidWorkflowTransition("Only queued runs can be rejected")
            self._finish(run, SeerWorkflowRunStatus.REJECTED, error=error)
        return run

    def complete_execution(
        self, execution_id: int, *, error: WorkflowRunError | None = None
    ) -> SeerWorkflowRunExecution:
        """Lock the parent so concurrent callbacks observe each other's completions."""
        with self._lock_run() as run:
            execution = run.executions.get(id=execution_id)
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
            if run.status != SeerWorkflowRunStatus.RUNNING:
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

            unfinished = run.executions.exclude(
                status__in=[
                    SeerWorkflowExecutionStatus.COMPLETE,
                    SeerWorkflowExecutionStatus.FAILED,
                ]
            ).exists()
            if not unfinished:
                failed = run.executions.filter(status=SeerWorkflowExecutionStatus.FAILED).exists()
                run.status = (
                    SeerWorkflowRunStatus.FAILED if failed else SeerWorkflowRunStatus.COMPLETE
                )
                run.date_completed = completed_at
                run.save(update_fields=["status", "date_completed", "date_updated"])
        return execution

    @contextmanager
    def _lock_run(self) -> Iterator[SeerWorkflowRun]:
        with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
            yield self._run_queryset().select_for_update().get(status__isnull=False)

    def _run_queryset(self) -> QuerySet[SeerWorkflowRun]:
        return SeerWorkflowRun.objects.using(router.db_for_write(SeerWorkflowRun)).filter(
            id=self.run_id, organization_id=self.organization_id
        )

    def _finish(
        self,
        run: SeerWorkflowRun,
        status: Literal[
            SeerWorkflowRunStatus.COMPLETE,
            SeerWorkflowRunStatus.FAILED,
            SeerWorkflowRunStatus.REJECTED,
        ],
        *,
        error: WorkflowRunError | None = None,
    ) -> None:
        extras = self._parse_extras(run, SeerWorkflowRunExtras)
        extras.error = error
        run.status = status
        run.extras = json.loads(extras.json())
        run.date_completed = timezone.now()
        run.save(update_fields=["status", "extras", "date_completed", "date_updated"])

    @staticmethod
    def _parse_extras[Extras: SeerWorkflowRunExtras](
        run: SeerWorkflowRun, extras_type: type[Extras]
    ) -> Extras:
        try:
            return extras_type.parse_obj(run.extras)
        except ValidationError:
            logger.exception(
                "seer.workflow.invalid_run_extras",
                extra={"run_id": run.id, "organization_id": run.organization_id},
            )
            raise


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
