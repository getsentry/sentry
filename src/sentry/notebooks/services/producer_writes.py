from __future__ import annotations

import hashlib
from collections.abc import Iterable
from copy import deepcopy
from datetime import datetime
from typing import Any
from uuid import UUID

from django.utils import timezone
from rest_framework import serializers

from sentry.models.project import Project
from sentry.notebooks.contracts import validate_text_result
from sentry.notebooks.models import (
    Notebook,
    NotebookBlock,
    NotebookBlockExecution,
    NotebookBlockExecutionProject,
    NotebookBlockExecutionStatus,
    NotebookBlockExecutor,
    NotebookBlockKind,
    NotebookProject,
)
from sentry.utils import json


class Unset:
    pass


UNSET = Unset()


def _default_display(kind: str) -> dict[str, Any]:
    if kind == NotebookBlockKind.TEXT:
        return {"type": "markdown"}
    return {
        "version": 1,
        "type": "table",
        "defaultView": "table",
        "queryCollapsed": True,
    }


def upsert_block(
    notebook: Notebook,
    *,
    key: str,
    revision: int,
    kind: str,
    request_id: UUID,
    complete: bool,
    from_snapshot: bool = False,
    position: int | Unset = UNSET,
    title: str | Unset = UNSET,
    config: dict[str, Any] | Unset = UNSET,
    display: dict[str, Any] | None = None,
    content: str | Unset = UNSET,
    generated_content: str | Unset = UNSET,
    prompt: str | Unset = UNSET,
    query_result: dict[str, Any] | None = None,
    project_ids: list[int],
    use_notebook_project_scope: bool = False,
    producing_seer_run_id: int | None = None,
    input_snapshot: dict[str, Any],
) -> NotebookBlock:
    """Create or update the producer block `(key, revision)` and record its execution.

    A field left UNSET keeps the block's value, and generated_content falls back to content.
    """

    block = (
        NotebookBlock.objects.filter(
            notebook=notebook,
            producer_revision=revision,
            producer_key=key,
        )
        .select_related("current_execution")
        .first()
    )
    if block is None:
        # Optional on the schema because an update may reuse the stored position,
        # but a block being created has none to fall back on.
        if isinstance(position, Unset):
            raise serializers.ValidationError({"payload": "position is required for a new block."})
        block = NotebookBlock(
            notebook=notebook,
            producer_revision=revision,
            producer_key=key,
            position=position,
            kind=kind,
        )
    elif block.kind != kind:
        previous_execution = block.current_execution
        if not from_snapshot and (
            previous_execution is None
            or previous_execution.input_snapshot.get("reportRevision", revision) >= revision
        ):
            raise serializers.ValidationError(
                {"payload": "Changing a report block's kind requires a new report revision."}
            )
        # A steered replacement keeps the block identity and its execution history,
        # but must not expose the previous kind's content as the new kind's output.
        block.kind = kind
        block.content = ""
        block.generated_content = ""
        block.prompt = ""
        block.config = {}
        block.display = {}
        block.content_execution = None
        block.result_execution = None

    if not isinstance(position, Unset):
        block.position = position
    title = block.title if isinstance(title, Unset) else title
    config = block.config if isinstance(config, Unset) else config
    incoming_display = display
    if incoming_display is None:
        incoming_display = {}
    elif not isinstance(incoming_display, dict):
        raise serializers.ValidationError({"payload": "display must be an object."})
    display = {**_default_display(kind), **block.display, **incoming_display}
    if kind == NotebookBlockKind.QUERY:
        if incoming_display.get("type") in {"table", "chart"} and "version" not in incoming_display:
            display["defaultView"] = incoming_display["type"]
        if display["type"] == "chart":
            chart = (query_result or {}).get("chart")
            display.update(
                {
                    "type": chart["visualization"] if chart else "table",
                    "defaultView": "chart" if chart else "table",
                }
            )
            if chart:
                display.update({"xAxis": "x", "yAxes": ["y"], "unit": chart["y_axis_unit"]})

    block.title = title
    block.config = deepcopy(config)
    block.display = deepcopy(display)
    block.producing_seer_run_id = producing_seer_run_id
    block.deleted_at = None
    if complete:
        content = block.content if isinstance(content, Unset) else content
        generated = content if isinstance(generated_content, Unset) else generated_content
        prompt = block.prompt if isinstance(prompt, Unset) else prompt
        block.content = content
        block.generated_content = generated
        block.prompt = prompt
    if block.pk:
        block.version += 1
    block.save()
    execution = NotebookBlockExecution.objects.filter(request_id=request_id).first()
    result = (
        query_result
        if kind == NotebookBlockKind.QUERY and complete
        else validate_text_result({"schemaVersion": 1, "markdown": block.generated_content})
        if complete
        else None
    )
    published_execution = (
        block.result_execution if kind == NotebookBlockKind.QUERY else block.content_execution
    )
    if published_execution is None and complete and use_notebook_project_scope:
        published_execution = (
            NotebookBlockExecution.objects.filter(
                block=block,
                status=NotebookBlockExecutionStatus.COMPLETED,
                result=result,
            )
            .order_by("-id")
            .first()
        )
    if published_execution is None and complete and use_notebook_project_scope:
        previous_block = (
            NotebookBlock.objects.filter(
                notebook=notebook,
                producer_key=key,
                kind=kind,
                producer_revision__lt=revision,
            )
            .select_related("content_execution", "result_execution")
            .order_by("-producer_revision")
            .first()
        )
        if previous_block is not None:
            published_execution = (
                previous_block.result_execution
                if kind == NotebookBlockKind.QUERY
                else previous_block.content_execution
            )
    scope_execution = execution
    if (
        (scope_execution is None or from_snapshot)
        and complete
        and published_execution is not None
        and published_execution.result == result
    ):
        scope_execution = published_execution
    project_ids = list(project_ids)
    if use_notebook_project_scope:
        # Scope selection can change while Seer runs. Reuse the resolved scope
        # for an existing attempt or an unchanged output recovered by a snapshot.
        scoped_project_ids = (
            scope_execution.data_project_links.values_list("project_id", flat=True)
            if scope_execution is not None
            else NotebookProject.objects.filter(notebook=notebook).values_list(
                "project_id", flat=True
            )
        )
        project_ids = sorted(set(project_ids) | set(scoped_project_ids))
        if not project_ids:
            raise serializers.ValidationError({"payload": "Investigation project scope is empty."})
    if execution is not None and (
        from_snapshot or execution.status == NotebookBlockExecutionStatus.COMPLETED
    ):
        project_ids = sorted(
            set(project_ids)
            | set(execution.data_project_links.values_list("project_id", flat=True))
        )
    projects = list(
        Project.objects.filter(
            organization_id=notebook.organization_id,
            id__in=project_ids,
        ).order_by("id")
    )
    if {project.id for project in projects} != set(project_ids):
        raise serializers.ValidationError(
            {"payload": "A result project is outside the investigation organization."}
        )
    snapshot = {
        **input_snapshot,
        "reportRevision": revision,
        "stableAgentKey": key,
        "projectIds": project_ids,
    }
    now = timezone.now()
    completed_at = None
    if complete:
        completed_at = (
            execution.completed_at
            if execution is not None and execution.status == NotebookBlockExecutionStatus.COMPLETED
            else now
        )
    defaults = {
        "block": block,
        "executor": NotebookBlockExecutor.CODE_MODE,
        "status": (
            NotebookBlockExecutionStatus.COMPLETED
            if complete
            else NotebookBlockExecutionStatus.RUNNING
        ),
        "block_version": block.version,
        "result_schema_version": 1,
        "result": result,
        "error": None,
        "completed_at": completed_at,
    }
    execution, _ = NotebookBlockExecution.objects.update_or_create(
        request_id=request_id,
        defaults=defaults,
        create_defaults={
            **defaults,
            "input_snapshot": snapshot,
            "input_fingerprint": hashlib.sha256(
                json.dumps(snapshot, sort_keys=True).encode()
            ).hexdigest(),
            "started_at": now,
        },
    )
    NotebookBlockExecutionProject.objects.filter(execution=execution).delete()
    NotebookBlockExecutionProject.objects.bulk_create(
        [
            NotebookBlockExecutionProject(execution=execution, project=project)
            for project in projects
        ]
    )
    block.current_execution = execution
    if kind == NotebookBlockKind.QUERY:
        if complete or block.result_execution_id is None:
            block.result_execution = execution
    else:
        if complete or block.content_execution_id is None:
            block.content_execution = execution
    if complete:
        block.stale_at = None
    block.save(
        update_fields=[
            "current_execution",
            "content_execution",
            "result_execution",
            "stale_at",
            "date_updated",
        ]
    )
    return block


def move_block(notebook: Notebook, *, key: str, revision: int, position: int) -> None:
    block = NotebookBlock.objects.filter(
        notebook=notebook,
        producer_revision=revision,
        producer_key=key,
        deleted_at__isnull=True,
    ).first()
    if block is None:
        raise serializers.ValidationError({"payload": "Report block was not found."})
    block.position = position
    block.version += 1
    block.save(update_fields=["position", "version", "date_updated"])


def remove_blocks(
    notebook: Notebook,
    *,
    revision: int | None = None,
    key: str | None = None,
    block_ids: Iterable[int] | None = None,
    all_blocks: bool = False,
    now: datetime | None = None,
) -> int:
    """Soft-delete the notebook's live producer blocks that match the filters.

    Pass all_blocks=True to remove every live producer block.
    """

    if revision is None and key is None and block_ids is None and not all_blocks:
        raise ValueError("remove_blocks needs a filter or all_blocks=True.")

    blocks = NotebookBlock.objects.filter(
        notebook=notebook,
        producer_revision__isnull=False,
        producer_key__isnull=False,
        deleted_at__isnull=True,
    )
    if revision is not None:
        blocks = blocks.filter(producer_revision=revision)
    if key is not None:
        blocks = blocks.filter(producer_key=key)
    if block_ids is not None:
        blocks = blocks.filter(id__in=block_ids)
    now = now or timezone.now()
    return blocks.update(deleted_at=now, date_updated=now)
