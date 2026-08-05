from __future__ import annotations

import hashlib
from typing import Any
from uuid import UUID

from django.db import router, transaction
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationBlockKind,
    InvestigationStatus,
)
from sentry.investigations.services.investigations import (
    InvestigationConflictError,
    InvestigationValidationError,
)
from sentry.utils import json

MAX_CONTEXT_BLOCKS = 20
MAX_CONTEXT_TEXT_CHARS = 50_000
MAX_CONTEXT_BYTES = 512 * 1024


def _fingerprint(snapshot: dict[str, Any]) -> str:
    serialized = json.dumps(snapshot, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


def _compact_query_context(
    result: Any, *, max_text_chars: int = MAX_CONTEXT_TEXT_CHARS
) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise InvestigationValidationError(
            {"context": "A query context block has no usable result."}
        )
    return {
        "schemaVersion": result.get("schemaVersion"),
        "tableMarkdown": str(result.get("tableMarkdown", ""))[:max_text_chars],
        "isEmpty": bool(result.get("isEmpty")),
        "queryLinks": result.get("queryLinks", []),
    }


def _materialize_dependency_context(
    block: InvestigationBlock, *, accessible_project_ids: set[int]
) -> tuple[dict[str, str | None], list[dict[str, Any]], list[int]]:
    links = list(
        block.dependency_links.select_related(
            "depends_on__content_execution",
            "depends_on__current_execution",
            "depends_on__result_execution",
        ).order_by("depends_on__position", "depends_on__id")
    )
    if len(links) > MAX_CONTEXT_BLOCKS:
        raise InvestigationValidationError(
            {"context": f"A block can use at most {MAX_CONTEXT_BLOCKS} context blocks."}
        )

    dependencies: dict[str, str | None] = {}
    context: list[dict[str, Any]] = []
    context_project_ids: set[int] = set()
    for link in links:
        dependency = link.depends_on
        dependency_execution = (
            dependency.result_execution
            if dependency.kind == InvestigationBlockKind.QUERY
            else dependency.content_execution
        )
        dependencies[str(dependency.id)] = (
            str(dependency_execution.id) if dependency_execution is not None else None
        )
        item: dict[str, Any] = {
            "block_id": str(dependency.id),
            "kind": dependency.kind,
            "title": dependency.title,
            "prompt": dependency.prompt,
        }

        if dependency.kind == InvestigationBlockKind.QUERY:
            if (
                dependency_execution is None
                or dependency_execution.status != InvestigationBlockExecutionStatus.COMPLETED
                or dependency.stale_at is not None
            ):
                raise InvestigationValidationError(
                    {
                        "context": f'Run the context block "{dependency.title or "Untitled query"}" first.'
                    }
                )
            item["result"] = _compact_query_context(dependency_execution.result)
        else:
            item["content"] = dependency.content[:MAX_CONTEXT_TEXT_CHARS]

        if dependency_execution is not None:
            represented_project_ids = set(
                dependency_execution.data_projects.order_by("id").values_list("id", flat=True)
            )
            if not represented_project_ids.issubset(accessible_project_ids):
                raise InvestigationValidationError(
                    {"context": "One or more context blocks use inaccessible project data."}
                )
            context_project_ids.update(represented_project_ids)
        context.append(item)

    if len(json.dumps(context).encode()) > MAX_CONTEXT_BYTES:
        raise InvestigationValidationError(
            {"context": "The selected block context is too large to send to the agent."}
        )
    return dependencies, context, sorted(context_project_ids)


def _materialize_notebook_context(
    block: InvestigationBlock, *, accessible_project_ids: set[int]
) -> tuple[dict[str, str | None], list[dict[str, Any]], list[int]]:
    """Snapshot every other visible block for text generation.

    A block's current attempt describes its status, while its successful output pointer
    supplies any content that remains visible during a rerun or after a failure.
    """
    blocks = list(
        block.investigation.blocks.filter(deleted_at__isnull=True)
        .exclude(id=block.id)
        .select_related("content_execution", "current_execution", "result_execution")
        .order_by("position", "id")
    )
    max_text_chars = min(
        MAX_CONTEXT_TEXT_CHARS,
        max(256, MAX_CONTEXT_BYTES // max(len(blocks), 1) - 1024),
    )
    dependencies: dict[str, str | None] = {}
    context: list[dict[str, Any]] = []
    context_project_ids: set[int] = set()

    for context_block in blocks:
        current_execution = context_block.current_execution
        visible_execution = (
            context_block.result_execution
            if context_block.kind == InvestigationBlockKind.QUERY
            else context_block.content_execution
        )
        dependencies[str(context_block.id)] = (
            str(visible_execution.id) if visible_execution is not None else None
        )
        item: dict[str, Any] = {
            "block_id": str(context_block.id),
            "kind": context_block.kind,
            "title": context_block.title,
            "prompt": context_block.prompt[:max_text_chars],
            "position": context_block.position,
            "version": context_block.version,
            "status": current_execution.status if current_execution is not None else "not_run",
            "stale": context_block.stale_at is not None,
            "currentExecutionId": (
                str(current_execution.id) if current_execution is not None else None
            ),
            "visibleExecutionId": (
                str(visible_execution.id) if visible_execution is not None else None
            ),
        }

        if context_block.kind == InvestigationBlockKind.QUERY:
            if (
                visible_execution is not None
                and visible_execution.status == InvestigationBlockExecutionStatus.COMPLETED
                and isinstance(visible_execution.result, dict)
            ):
                item["result"] = _compact_query_context(
                    visible_execution.result, max_text_chars=max_text_chars
                )
        else:
            item["content"] = context_block.content[:max_text_chars]

        if visible_execution is not None:
            represented_project_ids = set(
                visible_execution.data_projects.order_by("id").values_list("id", flat=True)
            )
            if not represented_project_ids.issubset(accessible_project_ids):
                raise InvestigationValidationError(
                    {"context": "One or more context blocks use inaccessible project data."}
                )
            context_project_ids.update(represented_project_ids)
        context.append(item)

    if len(json.dumps(context).encode()) > MAX_CONTEXT_BYTES:
        raise InvestigationValidationError(
            {"context": "The notebook context is too large to send to the agent."}
        )
    return dependencies, context, sorted(context_project_ids)


def build_block_execution_snapshot(
    *,
    block: InvestigationBlock,
    project_ids: list[int],
    project_slugs: list[str],
    accessible_project_ids: set[int],
) -> tuple[dict[str, Any], str]:
    prompt = (block.prompt or block.content).strip()
    parameters = {
        link.parameter.key: link.parameter.saved_value
        for link in block.parameter_links.select_related("parameter").order_by("parameter__key")
    }
    if block.kind == InvestigationBlockKind.TEXT:
        dependencies, context, context_project_ids = _materialize_notebook_context(
            block, accessible_project_ids=accessible_project_ids
        )
    else:
        dependencies, context, context_project_ids = _materialize_dependency_context(
            block, accessible_project_ids=accessible_project_ids
        )
    snapshot: dict[str, Any] = {
        "prompt": prompt,
        "filters": block.investigation.filters,
        "parameters": parameters,
        "dependencies": dependencies,
        "context": context,
        "contextDataProjectIds": context_project_ids,
        "projectIds": project_ids,
        "projectSlugs": project_slugs,
        "cellVersion": block.version,
        "investigationVersion": block.investigation.version,
    }
    dataset_hint = block.config.get("datasetHint")
    if dataset_hint is not None:
        snapshot["datasetHint"] = dataset_hint
    return snapshot, _fingerprint(snapshot)


def create_block_execution(
    *,
    block: InvestigationBlock,
    expected_investigation_version: int,
    expected_block_version: int,
    user_id: int,
    project_ids: list[int],
    project_slugs: list[str],
    accessible_project_ids: set[int],
    request_id: UUID | None = None,
) -> tuple[InvestigationBlockExecution, bool]:
    """Create a new immutable execution, or return the same explicit request retry."""
    database = router.db_for_write(InvestigationBlockExecution)
    with transaction.atomic(using=database):
        locked = (
            InvestigationBlock.objects.select_for_update()
            .select_related("investigation")
            .get(id=block.id)
        )
        if locked.investigation.version != expected_investigation_version:
            raise InvestigationConflictError("Investigation has changed.")
        if locked.version != expected_block_version:
            raise InvestigationConflictError("Block has changed.")
        if locked.deleted_at is not None:
            raise InvestigationValidationError({"detail": "The block has been deleted."})
        if locked.investigation.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        if locked.kind == InvestigationBlockKind.TEXT and not locked.prompt.strip():
            raise InvestigationValidationError(
                {"detail": "The text block needs a generation prompt."}
            )
        if (
            locked.kind == InvestigationBlockKind.QUERY
            and not (locked.prompt or locked.content).strip()
        ):
            raise InvestigationValidationError({"detail": "The query block needs a question."})
        if locked.kind == InvestigationBlockKind.QUERY and not project_ids:
            raise InvestigationValidationError(
                {"detail": "Select at least one accessible project before running this query."}
            )
        if len(project_ids) != len(project_slugs):
            raise InvestigationValidationError({"detail": "Invalid project scope."})

        snapshot, fingerprint = build_block_execution_snapshot(
            block=locked,
            project_ids=project_ids,
            project_slugs=project_slugs,
            accessible_project_ids=accessible_project_ids,
        )
        if request_id is not None:
            requested_execution = InvestigationBlockExecution.objects.filter(
                request_id=request_id
            ).first()
            if requested_execution is not None:
                if requested_execution.block_id != locked.id:
                    raise InvestigationValidationError(
                        {"requestId": "This execution request ID is already in use."}
                    )
                return requested_execution, False

        current = locked.current_execution
        if (
            request_id is None
            and current is not None
            and current.block_version == locked.version
            and current.input_fingerprint == fingerprint
            and current.status
            in {
                InvestigationBlockExecutionStatus.PENDING,
                InvestigationBlockExecutionStatus.RUNNING,
                InvestigationBlockExecutionStatus.AWAITING_INPUT,
                InvestigationBlockExecutionStatus.STOPPING,
            }
        ):
            return current, False

        dataset_hint = (
            snapshot.get("datasetHint") if locked.kind == InvestigationBlockKind.QUERY else None
        )
        if dataset_hint is not None and dataset_hint not in {
            "errors",
            "issues",
            "spans",
            "logs",
            "metrics",
        }:
            raise InvestigationValidationError({"detail": "The template dataset hint is invalid."})
        execution_values: dict[str, Any] = {
            "block": locked,
            "triggered_by_id": user_id,
            "executor": (
                InvestigationBlockExecutor.TEXT_GENERATION
                if locked.kind == InvestigationBlockKind.TEXT
                else InvestigationBlockExecutor.CODE_MODE
            ),
            "status": InvestigationBlockExecutionStatus.PENDING,
            "block_version": locked.version,
            "input_snapshot": snapshot,
            "input_fingerprint": fingerprint,
            "result_schema_version": 1,
        }
        if request_id is not None:
            execution_values["request_id"] = request_id
        execution = InvestigationBlockExecution.objects.create(**execution_values)
        locked.current_execution = execution
        locked.save(update_fields=["current_execution", "date_updated"])
        return execution, True


def mark_block_execution_dispatched(
    execution: InvestigationBlockExecution, *, seer_run_id: int
) -> None:
    InvestigationBlockExecution.objects.filter(
        id=execution.id, status=InvestigationBlockExecutionStatus.PENDING
    ).update(
        seer_run_id=seer_run_id,
        status=InvestigationBlockExecutionStatus.RUNNING,
        started_at=timezone.now(),
    )


def mark_block_execution_dispatch_failed(
    execution: InvestigationBlockExecution, *, error: str
) -> None:
    InvestigationBlockExecution.objects.filter(
        id=execution.id,
        status__in=[
            InvestigationBlockExecutionStatus.PENDING,
            InvestigationBlockExecutionStatus.RUNNING,
        ],
    ).update(
        status=InvestigationBlockExecutionStatus.FAILED,
        error={"code": "dispatch_failed", "message": error[:1000]},
        completed_at=timezone.now(),
    )
