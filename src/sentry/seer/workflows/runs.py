from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from functools import partial
from typing import Any
from uuid import UUID

from django.db import router, transaction
from django.db.models import QuerySet
from django.utils import timezone
from pydantic import BaseModel

from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunMirrorStatus
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.schemas import (
    WorkflowResult,
    WorkflowResultError,
    WorkflowRunError,
    WorkflowRunExtras,
    WorkflowRunSnapshot,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.utils import json

logger = logging.getLogger(__name__)
TERMINAL_STATUSES = {"complete", "partial", "failed"}


def get_or_create_workflow_run(
    *,
    organization_id: int,
    workflow_config_id: int,
    trigger_key: str,
    inputs: BaseModel,
) -> tuple[SeerWorkflowRun, bool]:
    """Record an invocation once; retries keep its original configuration and inputs."""
    if not trigger_key or len(trigger_key) > 256:
        raise ValueError("Trigger keys must contain between 1 and 256 characters")

    using = router.db_for_write(SeerWorkflowRun)
    runs = SeerWorkflowRun.objects.using(using).filter(
        organization_id=organization_id,
        workflow_config_id=workflow_config_id,
        trigger_key=trigger_key,
    )
    existing = runs.first()
    if existing is not None:
        return existing, False

    with transaction.atomic(using):
        config = SeerWorkflowConfig.objects.select_for_update().get(
            id=workflow_config_id, organization_id=organization_id
        )
        existing = runs.first()
        if existing is not None:
            return existing, False

        snapshot = WorkflowRunSnapshot(
            config_version=config.version,
            strategy=SeerWorkflowStrategy(config.strategy),
            filters=config.filters,
            project_ids=tuple(SeerWorkflow(config).get_project_ids()),
            output_policy=config.output_policy,
            inputs=json.loads(inputs.json()),
        )
        run = SeerWorkflowRun.objects.using(using).create(
            organization_id=organization_id,
            workflow_config=config,
            trigger_key=trigger_key,
            status=SeerWorkflowRunStatus.RUNNING,
            date_started=timezone.now(),
            snapshot=json.loads(snapshot.json()),
        )
    return run, True


def complete_workflow_run(
    *,
    organization_id: int,
    workflow_run_id: int,
    error: WorkflowRunError | None = None,
) -> SeerWorkflowRun:
    """Finish a run that has no executions, including selection failure or no-work success."""
    with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
        run = SeerWorkflowRun.objects.select_for_update().get(
            id=workflow_run_id, organization_id=organization_id, trigger_key__isnull=False
        )
        if run.date_completed is not None:
            return run

        if run.executions.exists():
            raise ValueError("Finish the run's executions with complete_workflow_execution")
        run.status = SeerWorkflowRunStatus.FAILED if error else SeerWorkflowRunStatus.COMPLETE
        run.error = error.dict() if error else None
        run.date_completed = timezone.now()
        run.save(update_fields=["status", "error", "date_completed", "date_updated"])
    return run


def complete_workflow_execution(
    *,
    organization_id: int,
    workflow_execution_id: int,
    error: WorkflowRunError | None = None,
) -> SeerWorkflowRunExecution:
    """Finish one execution and finalize the run after all executions have finished.

    Create the complete execution plan before dispatching any work. Lock the parent first
    so simultaneous callbacks cannot both miss the other execution's completion.
    """
    with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
        execution = SeerWorkflowRunExecution.objects.get(
            id=workflow_execution_id, run__organization_id=organization_id
        )
        run = SeerWorkflowRun.objects.select_for_update().get(
            id=execution.run_id, organization_id=organization_id
        )
        execution.refresh_from_db()
        if execution.date_completed is not None:
            return execution
        execution.status = (
            SeerWorkflowExecutionStatus.FAILED if error else SeerWorkflowExecutionStatus.COMPLETE
        )
        execution.error = error.dict() if error else None
        execution.date_completed = timezone.now()
        execution.save(update_fields=["status", "error", "date_completed", "date_updated"])

        unfinished = run.executions.exclude(
            status__in=[SeerWorkflowExecutionStatus.COMPLETE, SeerWorkflowExecutionStatus.FAILED]
        ).exists()
        if run.date_completed is None and not unfinished:
            failed = run.executions.filter(status=SeerWorkflowExecutionStatus.FAILED).first()
            run.status = SeerWorkflowRunStatus.FAILED if failed else SeerWorkflowRunStatus.COMPLETE
            run.error = failed.error if failed else None
            run.date_completed = execution.date_completed
            run.save(update_fields=["status", "error", "date_completed", "date_updated"])
    return execution


def get_workflow_runs(
    *,
    organization_id: int,
    workflow_config_id: int | None = None,
) -> QuerySet[SeerWorkflowRun]:
    runs = SeerWorkflowRun.objects.filter(organization_id=organization_id)
    if workflow_config_id is not None:
        runs = runs.filter(workflow_config_id=workflow_config_id)
    return runs.order_by("-date_added", "-id")


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
