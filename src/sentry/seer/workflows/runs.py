from __future__ import annotations

import logging
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Literal

from django.db import router, transaction
from django.db.models import QuerySet
from django.utils import timezone
from pydantic import ValidationError

from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionExtras,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunExtras,
    SeerWorkflowRunStatus,
    WorkflowRunError,
)
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

    @classmethod
    def create(
        cls, config: SeerWorkflowConfig, *, trigger_key: str, extras: SeerWorkflowRunExtras
    ) -> SeerWorkflowRunLifecycle:
        """Record a queued run of ``config``. Callers must hold the config's row lock."""
        run = SeerWorkflowRun.objects.using(router.db_for_write(SeerWorkflowRun)).create(
            organization_id=config.organization_id,
            workflow_config=config,
            trigger_key=trigger_key,
            status=SeerWorkflowRunStatus.QUEUED,
            extras=json.loads(extras.json()),
        )
        return cls(run_id=run.id, organization_id=run.organization_id)

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
