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

from sentry.api.exceptions import ConflictError
from sentry.api.helpers.creator import CreatorReference
from sentry.investigations.contracts import valid_action_request
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.investigations.services.orchestration_events import complete_report_metadata
from sentry.models.organization import Organization
from sentry.notebooks.contracts import MAX_MARKDOWN_CHARS
from sentry.notebooks.models import Notebook, NotebookBlock, NotebookBlockKind, NotebookWorkflowRun
from sentry.notebooks.services.action_requests import sync_snapshot_action_requests
from sentry.notebooks.services.notebooks import (
    _validate_project_ids,
    create_manual_notebook,
    require_workflow_writer,
    validate_evidence_scope,
)
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
    with transaction.atomic(using=router.db_for_write(Notebook)):
        binding, _ = NotebookWorkflowRun.objects.get_or_create(
            organization=organization, run_id=run_id, defaults={"notebook": destination_notebook}
        )
        if destination is not None and destination.id != binding.notebook_id:
            raise ConflictError("This workflow already opened another notebook.")
        notebook = Notebook.objects.select_for_update().get(
            pk=binding.notebook_id, organization=organization
        )
        if notebook.status != "active":
            raise ConflictError("Archived notebooks are read-only.")
        evidence = _validate_project_ids(organization.id, project_ids)
        validate_evidence_scope(list(notebook.projects.values_list("id", flat=True)), evidence)
        prior = notebook.workflow_project_ids
        if prior is not None:
            evidence = sorted(set(prior).union(evidence)) if prior and evidence else []
        if evidence != prior:
            notebook.update(workflow_project_ids=evidence)
        return notebook


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
    organization: Organization, run_id: UUID, seer_run_state_id: int, user_id: int | None
) -> UUID:
    """Mirror the Explorer child attested by Seer's worker after the actor opened the notebook."""
    with transaction.atomic(using=router.db_for_write(NotebookWorkflowRun)):
        binding = NotebookWorkflowRun.objects.select_for_update().get(
            organization=organization, run_id=run_id
        )
        writer, _ = SeerRun.objects.get_or_create(
            seer_run_state_id=seer_run_state_id,
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
            raise ConflictError("The writer run does not match this workflow.")
        if binding.writer_run_id != writer.id:
            previous = binding.writer_run
            if previous and (previous.seer_run_state_id or 0) > seer_run_state_id:
                raise ConflictError("A later writer has already opened this notebook.")
            binding.update(writer_run_id=writer.id)
        return writer.uuid


def write_workflow_block(
    notebook: Notebook,
    *,
    workflow_run_id: UUID,
    writer_run_id: int,
    key: str,
    revision: int,
    kind: str,
    user_id: int | None,
    block_version: int | None = None,
    content: str = "",
    embed: dict[str, Any] | None = None,
    embed_source: str | None = None,
) -> tuple[NotebookBlock, bool]:
    with notebook_writes(notebook) as writes:
        require_workflow_writer(notebook, workflow_run_id, writer_run_id)
        blocks = notebook.blocks
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
            == (kind, content, embed, embed_source)
        ):
            return block, False
        if revision != (block.producer_revision or 0) + 1:
            raise ConflictError("Read the block and use the next producer revision.")
        if block.deleted_at is not None:
            raise ConflictError("This block was removed. Use a new key to append a block.")
        if block_version != (None if created else block.version):
            raise ConflictError("Read the block before changing its contents.")
        block.kind = kind
        block.content = content
        block.generated_content = content
        block.embed = embed
        block.embed_source = embed_source
        block.embed_summary = None
        block.producer_revision = revision
        block.producing_seer_run_id = writer_run_id
        block.last_edited_by_id = user_id
        if not created:
            block.version += 1
        block.save()
        writes.mark_changed()
        return block, created


def save_summary(
    binding: NotebookWorkflowRun, writer_run_id: int, block_id: int, version: int, finding: str
) -> NotebookBlock:
    notebook = binding.notebook
    with notebook_writes(notebook) as writes:
        require_workflow_writer(notebook, binding.run_id, writer_run_id)
        block = notebook.blocks.filter(
            pk=block_id, deleted_at__isnull=True, kind=NotebookBlockKind.EMBED
        ).first()
        if block is None:
            raise ConflictError("The block has been removed or replaced.")
        # Keep the original multiline query separately. Its JSON representation fits on one line.
        source = block.embed_source or ""
        source_line = json.dumps(source) if "\n" in source or "\r" in source else source
        summary = f"{finding}\n{source_line}"
        if block.version == version + 1 and block.embed_summary == summary:
            return block
        if block.version != version:
            raise ConflictError("The block changed while its summary was being generated.")
        block.update(embed_summary=summary, version=block.version + 1)
        writes.mark_changed()
        return block


def content_revision(notebook: Notebook) -> str:
    versions = (
        notebook.blocks.filter(deleted_at__isnull=True)
        .order_by("position", "id")
        .values_list("id", "version", "result_execution_id")
    )
    return block_revision(versions)


def block_revision(versions: Iterable[tuple[int, int, int | None]]) -> str:
    # Keep the existing revision for blocks without a published query result.
    rows = [
        (pk, version, result) if result is not None else (pk, version)
        for pk, version, result in versions
    ]
    return hashlib.sha256(json.dumps(rows).encode()).hexdigest()


def deliver_finalizer(
    binding: NotebookWorkflowRun, revision: str, section: str, result: dict[str, Any]
) -> None:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        # Notebook edits and orchestration events acquire the notebook lock first.
        notebook = Notebook.objects.select_for_update().get(pk=binding.notebook_id)
        orchestration = (
            InvestigationOrchestrationRun.objects.select_for_update()
            .filter(investigation_id=binding.notebook_id)
            .first()
        )
        binding = NotebookWorkflowRun.objects.select_for_update().get(pk=binding.pk)
        if binding.delivered.get(section) == revision:
            return
        if notebook.status != "active" or content_revision(notebook) != revision:
            raise ConflictError("Notebook contents changed after authoring.")
        blocks = notebook.blocks.filter(deleted_at__isnull=True)
        if not blocks.exists():
            raise ConflictError("The notebook is empty.")
        if blocks.filter(kind=NotebookBlockKind.EMBED, embed_summary__isnull=True).exists():
            raise ConflictError("A rich block is awaiting its summary.")
        if section == "metadata" and orchestration:
            orchestration.investigation = notebook
            complete_report_metadata(
                orchestration,
                {
                    "title": None if binding.preserve_title else result["title"],
                    "summary": result["summary"],
                    "summaryDescription": result["description"],
                },
            )
            orchestration.save(update_fields=["projection", "notebook_revision", "date_updated"])
        elif section == "metadata":
            notebook.update(
                title=notebook.title if binding.preserve_title else result["title"],
                summary=result["summary"],
                summary_description=result["description"],
                version=notebook.version + 1,
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
            sync_snapshot_action_requests(notebook, actions, workflow_run=binding)
            notebook.update(version=notebook.version + 1)
        binding.update(delivered={**binding.delivered, section: revision})
