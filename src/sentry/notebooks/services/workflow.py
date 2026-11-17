from __future__ import annotations

import hashlib
from collections.abc import Iterable
from typing import Any
from uuid import UUID

import jsonschema
from django.db import router, transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers

from sentry.api.helpers.creator import CreatorReference
from sentry.investigations.contracts import valid_action_request
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.investigations.services.orchestration_events import complete_report_metadata
from sentry.models.organization import Organization
from sentry.notebooks.contracts import MAX_MARKDOWN_CHARS
from sentry.notebooks.models import Notebook, NotebookBlock, NotebookBlockKind, NotebookWorkflowRun
from sentry.notebooks.services.action_requests import sync_snapshot_action_requests
from sentry.notebooks.services.notebooks import NotebookConflictError, create_manual_notebook
from sentry.notebooks.services.producer_writes import notebook_writes
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.utils import json


def open_workflow_notebook(
    organization: Organization,
    run_id: UUID,
    *,
    destination: Notebook | None,
    creator: CreatorReference,
    title: str,
    project_ids: list[int],
) -> Notebook:
    def destination_notebook() -> Notebook:
        return destination or create_manual_notebook(
            organization=organization,
            creator=creator,
            title=title,
            project_ids=project_ids,
            filters={},
        )

    # get_or_create evaluates callable defaults inside its savepoint. A simultaneous
    # first open that loses the unique-key race also rolls back its blank notebook.
    binding, _ = NotebookWorkflowRun.objects.get_or_create(
        organization=organization, run_id=run_id, defaults={"notebook": destination_notebook}
    )
    if destination is not None and destination.id != binding.notebook_id:
        raise NotebookConflictError("This workflow already opened another notebook.")
    return binding.notebook


def validate_embed(value: Any, widgets: list[dict[str, Any]]) -> None:
    if not isinstance(value, dict) or set(value) != {"name", "body"}:
        raise serializers.ValidationError({"embed": "Provide a widget name and body."})
    widget = next(
        (w for w in widgets if w["name"] == value["name"] and "block" in w["level"]), None
    )
    if widget is None or len(json.dumps(value)) > MAX_MARKDOWN_CHARS:
        raise serializers.ValidationError({"embed": "Unknown, unavailable, or oversized widget."})
    try:
        jsonschema.validate(value["body"], widget.get("body") or {})
    except jsonschema.ValidationError as error:
        raise serializers.ValidationError({"embed": error.message}) from error


def link_writer_run(
    organization: Organization, run_id: UUID, state_id: int, user_id: int | None
) -> UUID:
    """Mirror the Explorer child attested by Seer's worker after the actor opened the notebook."""
    with transaction.atomic(using=router.db_for_write(NotebookWorkflowRun)):
        binding = NotebookWorkflowRun.objects.select_for_update().get(
            organization=organization, run_id=run_id
        )
        writer, _ = SeerRun.objects.get_or_create(
            seer_run_state_id=state_id,
            defaults={
                "organization": organization,
                "user_id": user_id,
                "type": SeerRunType.EXPLORER,
                "mirror_status": SeerRunMirrorStatus.LIVE,
                "last_triggered_at": timezone.now(),
                "referrer": "workflow.notebook",
            },
        )
        if writer.organization_id != organization.id or writer.type != SeerRunType.EXPLORER:
            raise NotebookConflictError("The writer run does not match this workflow.")
        if binding.writer_run_id != writer.id:
            if binding.writer_run and (binding.writer_run.seer_run_state_id or 0) > state_id:
                raise NotebookConflictError("A later writer has already opened this notebook.")
            binding.writer_run = writer
            binding.save(update_fields=["writer_run", "date_updated"])
        return writer.uuid


def write_workflow_block(
    notebook: Notebook,
    *,
    run_id: UUID,
    key: str,
    revision: int,
    block_version: int | None,
    kind: str,
    content: str,
    embed: dict[str, Any] | None,
    source: str | None,
    user_id: int | None,
) -> tuple[NotebookBlock, bool]:
    with notebook_writes(notebook) as writes:
        try:
            writer_id = NotebookWorkflowRun.objects.values_list(
                "writer_run__seer_run_state_id", flat=True
            ).get(organization_id=notebook.organization_id, run_id=run_id, notebook=notebook)
        except NotebookWorkflowRun.DoesNotExist:
            raise serializers.ValidationError(
                {"workflowRunId": "Open this notebook first."}
            ) from None
        blocks = NotebookBlock.objects.filter(notebook=notebook)
        stored_key = f"workflow:{key}"
        block = blocks.filter(producer_key=stored_key).order_by("-producer_revision").first()
        created = block is None
        if block is None:
            position = blocks.filter(deleted_at__isnull=True).aggregate(last=Max("position"))[
                "last"
            ]
            block = NotebookBlock(
                notebook=notebook,
                producer_key=stored_key,
                created_by_id=user_id,
                position=0 if position is None else position + 1,
            )
        elif (
            revision == block.producer_revision
            and block.deleted_at is None
            and (block.kind, block.content, block.embed, block.embed_source)
            == (kind, content, embed, source)
        ):
            return block, False
        if revision != (block.producer_revision or 0) + 1:
            raise NotebookConflictError("Read the block and use the next producer revision.")
        if block.deleted_at is not None:
            raise NotebookConflictError("This block was removed. Use a new key to append a block.")
        if (not created and block_version != block.version) or (
            created and block_version is not None
        ):
            raise NotebookConflictError("Read the block before changing its contents.")
        block.kind = kind
        block.content = content
        block.generated_content = content
        block.embed = embed
        block.embed_source = source
        block.embed_summary = None
        block.producer_revision = revision
        block.producing_seer_run_id = writer_id
        block.last_edited_by_id = user_id
        if not created:
            block.version += 1
        block.save()
        writes.mark_changed()
        return block, created


def save_summary(notebook: Notebook, block_id: int, version: int, finding: str) -> NotebookBlock:
    with notebook_writes(notebook) as writes:
        block = NotebookBlock.objects.filter(
            notebook=notebook, pk=block_id, deleted_at__isnull=True, kind=NotebookBlockKind.EMBED
        ).first()
        if block is None:
            raise NotebookConflictError("The block has been removed or replaced.")
        # Keep the original multiline query separately. Its JSON representation fits on one line.
        source = block.embed_source or ""
        source_line = json.dumps(source) if "\n" in source or "\r" in source else source
        summary = f"{finding}\n{source_line}"
        if block.version == version + 1 and block.embed_summary == summary:
            return block
        if block.version != version:
            raise NotebookConflictError("The block changed while its summary was being generated.")
        block.embed_summary = summary
        block.version += 1
        block.save(update_fields=["embed_summary", "version", "date_updated"])
        writes.mark_changed()
        return block


def content_revision(notebook: Notebook) -> str:
    versions = (
        NotebookBlock.objects.filter(notebook=notebook, deleted_at__isnull=True)
        .order_by("position", "id")
        .values_list("id", "version")
    )
    return block_revision(versions)


def block_revision(versions: Iterable[tuple[int, int]]) -> str:
    return hashlib.sha256(json.dumps(list(versions)).encode()).hexdigest()


def deliver_finalizer(
    binding: NotebookWorkflowRun, revision: str, section: str, result: dict[str, Any]
) -> None:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        # Legacy orchestration also locks its run before its notebook.
        orchestration = (
            InvestigationOrchestrationRun.objects.select_for_update()
            .filter(investigation_id=binding.notebook_id)
            .first()
        )
        binding = NotebookWorkflowRun.objects.select_for_update().get(pk=binding.pk)
        notebook = Notebook.objects.select_for_update().get(pk=binding.notebook_id)
        if binding.delivered.get(section) == revision:
            return
        if notebook.status != "active" or content_revision(notebook) != revision:
            raise NotebookConflictError("Notebook contents changed after authoring.")
        blocks = NotebookBlock.objects.filter(notebook=notebook, deleted_at__isnull=True)
        if not blocks.exists():
            raise NotebookConflictError("The notebook is empty.")
        if blocks.filter(
            kind=NotebookBlockKind.EMBED,
            embed_summary__isnull=True,
        ).exists():
            raise NotebookConflictError("A rich block is awaiting its summary.")
        if section == "metadata" and orchestration:
            orchestration.investigation = notebook
            complete_report_metadata(
                orchestration,
                {
                    "title": result["title"],
                    "summary": result["summary"],
                    "summaryDescription": result["description"],
                },
            )
            orchestration.save(update_fields=["projection", "notebook_revision", "date_updated"])
        elif section == "metadata":
            notebook.title = result["title"]
            notebook.summary = result["summary"]
            notebook.summary_description = result["description"]
            notebook.version += 1
            notebook.save(
                update_fields=["version", "title", "summary", "summary_description", "date_updated"]
            )
        else:
            actions = []
            for item in result["suggestions"]:
                action = valid_action_request(
                    {"impact": None, **item, "reportRevision": notebook.version}
                )
                if action is None:
                    raise serializers.ValidationError({"suggestions": "Invalid next step."})
                actions.append(action)
            sync_snapshot_action_requests(notebook, actions)
            notebook.version += 1
            notebook.save(update_fields=["version", "date_updated"])
        binding.delivered = {**binding.delivered, section: revision}
        binding.save(update_fields=["delivered", "date_updated"])
