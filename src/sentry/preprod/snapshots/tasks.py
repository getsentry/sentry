from __future__ import annotations

from typing import Any

from taskbroker_client.retry import Retry

from sentry.preprod.snapshots import workflow
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks

CHUNK_PROCESSING_DEADLINE = 120


def _workflow_tasks() -> workflow.WorkflowTasks:
    return workflow.WorkflowTasks(
        compare=compare_snapshots.apply_async,
        chunk=process_snapshot_comparison_chunk.apply_async,
        finalize=finalize_snapshot_comparison.apply_async,
    )


@instrumented_task(
    name="sentry.preprod.tasks.compare_snapshots",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=300,
)
def compare_snapshots(
    project_id: int,
    org_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    **kwargs: Any,
) -> None:
    workflow.compare_snapshots(
        project_id, org_id, head_artifact_id, base_artifact_id, _workflow_tasks()
    )


@instrumented_task(
    name="sentry.preprod.tasks.process_snapshot_comparison_chunk",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=CHUNK_PROCESSING_DEADLINE,
)
def process_snapshot_comparison_chunk(
    comparison_id: int,
    chunk_index: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    execution_id: str | None = None,
    **kwargs: Any,
) -> None:
    workflow.process_snapshot_comparison_chunk(
        comparison_id,
        chunk_index,
        org_id,
        project_id,
        head_artifact_id,
        base_artifact_id,
        _workflow_tasks(),
        execution_id,
    )


@instrumented_task(
    name="sentry.preprod.tasks.finalize_snapshot_comparison",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=300,
)
def finalize_snapshot_comparison(
    comparison_id: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
    execution_id: str | None = None,
    **kwargs: Any,
) -> None:
    workflow.finalize_snapshot_comparison(
        comparison_id,
        org_id,
        project_id,
        head_artifact_id,
        base_artifact_id,
        _workflow_tasks(),
        execution_id,
    )
