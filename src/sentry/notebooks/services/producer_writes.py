from __future__ import annotations

import hashlib
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from copy import deepcopy
from typing import Any
from uuid import UUID, uuid5

from django.db import router, transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers

from sentry.models.project import Project
from sentry.notebooks.contracts import MAX_MARKDOWN_CHARS, validate_text_result
from sentry.notebooks.models import (
    Notebook,
    NotebookBlock,
    NotebookBlockExecution,
    NotebookBlockExecutionProject,
    NotebookBlockExecutionStatus,
    NotebookBlockExecutor,
    NotebookBlockKind,
    NotebookProject,
    NotebookStatus,
)
from sentry.notebooks.services.notebooks import NotebookConflictError, NotebookValidationError
from sentry.utils import json


class Unset:
    pass


class NewerProducerRevision(serializers.ValidationError):
    pass


UNSET = Unset()


class NotebookWrites:
    """A locked notebook that producer block writes go through. Open one with notebook_writes()."""

    def __init__(self, notebook: Notebook) -> None:
        self._notebook = notebook
        self._open = True
        self.changed = False

    @property
    def notebook(self) -> Notebook:
        if not self._open:
            raise RuntimeError("This notebook_writes() block has exited.")
        return self._notebook

    def mark_changed(self) -> None:
        self.changed = True


@contextmanager
def notebook_writes(notebook: Notebook) -> Iterator[NotebookWrites]:
    """Lock an active notebook for producer writes, and bump its version once if they changed it."""

    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = Notebook.objects.select_for_update().get(id=notebook.id)
        if locked.status == NotebookStatus.ARCHIVED:
            raise serializers.ValidationError({"detail": "Archived investigations are read-only."})
        notebook.status = locked.status
        notebook.version = locked.version
        writes = NotebookWrites(notebook)
        try:
            yield writes
        finally:
            writes._open = False
        if writes.changed:
            notebook.version += 1
            notebook.date_updated = timezone.now()
            notebook.save(update_fields=["version", "date_updated"])


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
    writes: NotebookWrites,
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
    """Write the producer block for `key` at `revision` and record its execution.

    A newer revision updates the block in place, and an older one is rejected. A field
    left UNSET keeps the block's value, and generated_content falls back to content.
    """

    notebook = writes.notebook
    with transaction.atomic(using=router.db_for_write(NotebookBlock)):
        block = _live_block(notebook, key)
        if block is None:
            # Removed rows still fence the key. Bring back a block removed in this
            # revision, since the revision and key stay unique.
            newest = (
                NotebookBlock.objects.filter(
                    notebook=notebook, producer_key=key, producer_revision__isnull=False
                )
                .order_by("-producer_revision")
                .first()
            )
            if newest is not None:
                _check_revision(newest, revision)
                if newest.producer_revision == revision:
                    block = newest
        else:
            _check_revision(block, revision)
        if block is None:
            # Optional on the schema because an update may reuse the stored position,
            # but a block being created has none to fall back on.
            if isinstance(position, Unset):
                raise serializers.ValidationError(
                    {"payload": "position is required for a new block."}
                )
            block = NotebookBlock(
                notebook=notebook,
                producer_revision=revision,
                producer_key=key,
                position=position,
                kind=kind,
            )
        elif block.kind != kind:
            if not from_snapshot and block.producer_revision == revision:
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
            if (
                incoming_display.get("type") in {"table", "chart"}
                and "version" not in incoming_display
            ):
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
        block.producer_revision = revision
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
        if execution is not None and execution.block_id != block.id:
            raise serializers.ValidationError(
                {"requestId": "This execution request ID is already in use."}
            )
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
                raise serializers.ValidationError(
                    {"payload": "Investigation project scope is empty."}
                )
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
                if execution is not None
                and execution.status == NotebookBlockExecutionStatus.COMPLETED
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
    writes.mark_changed()
    return block


# How far one API write can move a key's revision. Producers count up by one, so this
# leaves room for skipped revisions while no single write can fence the key near I32_MAX.
MAX_REVISION_STEP = 100

# Request IDs for producer writes made through the notebook API.
_API_EXECUTION_NAMESPACE = UUID("80e0d41c-f969-4a16-9b0d-dddfc844f713")


def write_api_producer_block(
    notebook: Notebook,
    *,
    key: str,
    revision: int,
    kind: str,
    position: int | None,
    title: str | Unset = UNSET,
    content: str | Unset = UNSET,
    prompt: str | Unset = UNSET,
    config: dict[str, Any] | Unset = UNSET,
    display: dict[str, Any] | None = None,
) -> tuple[NotebookBlock, bool]:
    """Write a complete producer block that a caller sent through the notebook API.

    The bool is True when the key had no live block. `position` is an index among the
    live blocks; a new block with no position goes last.
    """
    with notebook_writes(notebook) as writes:
        # Deleted rows count, as they do for the newer-revision check.
        stored = (
            NotebookBlock.objects.filter(notebook=writes.notebook, producer_key=key)
            .aggregate(newest=Max("producer_revision"))
            .get("newest")
        )
        if revision > (stored or 0) + MAX_REVISION_STEP:
            raise NotebookValidationError(
                {"revision": f"Raise revision by at most {MAX_REVISION_STEP} per write."}
            )
        live = _live_block(writes.notebook, key)
        if position is not None:
            position = _make_room_at(writes.notebook, position, moving=live)
        elif live is None:
            last = (
                NotebookBlock.objects.filter(notebook=writes.notebook, deleted_at__isnull=True)
                .aggregate(last=Max("position"))
                .get("last")
            )
            position = 0 if last is None else last + 1
        try:
            block = upsert_block(
                writes,
                key=key,
                revision=revision,
                kind=kind,
                request_id=uuid5(
                    _API_EXECUTION_NAMESPACE, f"{notebook.id}:{revision}:{key}:{kind}"
                ),
                complete=True,
                position=UNSET if position is None else position,
                title=title,
                config=config,
                display=display,
                content=content,
                prompt=prompt,
                # A notebook with no projects takes blocks too, so its scope may be empty.
                project_ids=list(
                    NotebookProject.objects.filter(notebook=writes.notebook).values_list(
                        "project_id", flat=True
                    )
                ),
                input_snapshot={"source": deepcopy(writes.notebook.source)},
            )
        except NewerProducerRevision:
            raise NotebookConflictError("The block has a newer revision.")
    return block, live is None


def _make_room_at(notebook: Notebook, index: int, *, moving: NotebookBlock | None) -> int:
    """Renumber the other live blocks around a gap at `index`, clamped to their count."""
    blocks = NotebookBlock.objects.select_for_update().filter(
        notebook=notebook, deleted_at__isnull=True
    )
    if moving is not None:
        blocks = blocks.exclude(id=moving.id)
    others = list(blocks.order_by("position", "id"))
    index = min(index, len(others))
    for position, block in enumerate(others):
        block.position = position if position < index else position + 1
    NotebookBlock.objects.bulk_update(others, ["position"])
    return index


def append_block_content(
    writes: NotebookWrites, *, key: str, revision: int, text: str, reset: bool = False
) -> bool:
    """Stream text into a started text block. Returns whether the block changed."""

    block = _live_block(writes.notebook, key)
    if block is None or block.kind != NotebookBlockKind.TEXT:
        raise serializers.ValidationError({"payload": "Text block was not started."})
    _check_revision(block, revision)
    if block.producer_revision != revision:
        raise serializers.ValidationError({"payload": "Text block was not started."})
    # A rewrite keeps showing the previous output until it completes.
    if block.content_execution_id != block.current_execution_id:
        return False
    if (0 if reset else len(block.content)) + len(text) > MAX_MARKDOWN_CHARS:
        raise serializers.ValidationError({"payload": "Text block exceeds its size limit."})
    block.content = text if reset else block.content + text
    block.generated_content = text if reset else block.generated_content + text
    block.version += 1
    block.save(update_fields=["content", "generated_content", "version", "date_updated"])
    writes.mark_changed()
    return True


def move_block(writes: NotebookWrites, *, key: str, revision: int, position: int) -> None:
    block = _live_block(writes.notebook, key)
    if block is None:
        raise serializers.ValidationError({"payload": "Report block was not found."})
    _check_revision(block, revision)
    block.position = position
    block.version += 1
    block.save(update_fields=["position", "version", "date_updated"])
    writes.mark_changed()


def remove_blocks(
    writes: NotebookWrites,
    *,
    revision: int | None = None,
    key: str | None = None,
    block_ids: Iterable[int] | None = None,
    revision_below: int | None = None,
    all_blocks: bool = False,
) -> list[str]:
    """Soft-delete the notebook's live producer blocks that match the filters, and return
    their keys.

    Pass all_blocks=True to remove every live producer block.
    """

    if (
        revision is None
        and key is None
        and block_ids is None
        and revision_below is None
        and not all_blocks
    ):
        raise ValueError("remove_blocks needs a filter or all_blocks=True.")

    blocks = NotebookBlock.objects.filter(
        notebook=writes.notebook,
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
    if revision_below is not None:
        blocks = blocks.filter(producer_revision__lt=revision_below)
    removed = list(blocks.values_list("id", "producer_key"))
    now = timezone.now()
    NotebookBlock.objects.filter(id__in=[block_id for block_id, _ in removed]).update(
        deleted_at=now, date_updated=now
    )
    if removed:
        writes.mark_changed()
    return [block_key for _, block_key in removed if block_key is not None]


def _live_block(notebook: Notebook, key: str) -> NotebookBlock | None:
    return NotebookBlock.objects.filter(
        notebook=notebook, producer_key=key, deleted_at__isnull=True
    ).first()


def _check_revision(block: NotebookBlock, revision: int) -> None:
    if block.producer_revision is not None and block.producer_revision > revision:
        raise NewerProducerRevision({"payload": "The block has a newer revision."})
