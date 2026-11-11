from __future__ import annotations

from collections.abc import Iterable
from copy import deepcopy
from typing import Any

from django.db import router, transaction
from django.db.models import Max
from django.utils import timezone

from sentry.api.helpers.creator import CreatorReference
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notebooks.models import (
    Notebook,
    NotebookBlock,
    NotebookBlockExecution,
    NotebookBlockExecutionStatus,
    NotebookProject,
    NotebookSourceType,
    NotebookStatus,
)

UPDATABLE_NOTEBOOK_FIELDS = frozenset({"title", "status", "filters"})
MAX_NOTEBOOK_TITLE_LENGTH = 255
# Placeholder used before titles were derived from the investigation type.
DEFAULT_NOTEBOOK_TITLE = "Untitled investigation"

CREATABLE_BLOCK_FIELDS = frozenset({"kind", "title", "content", "prompt", "config", "display"})
UPDATABLE_BLOCK_FIELDS = CREATABLE_BLOCK_FIELDS - {"kind"}


_NOTEBOOK_TYPE_LABELS: dict[str, str] = {
    NotebookSourceType.MANUAL: "manual",
    NotebookSourceType.METRIC_OPEN_PERIOD: "breached metrics",
}


def default_notebook_title(source_type: str) -> str:
    """Placeholder title shown until Seer names the investigation."""

    label = _NOTEBOOK_TYPE_LABELS.get(source_type, "manual")
    return f"New {label} investigation"


def has_default_notebook_title(notebook: Notebook) -> bool:
    return notebook.title in {
        DEFAULT_NOTEBOOK_TITLE,
        default_notebook_title(notebook.source_type),
    }


def _reject_unsupported_fields(values: dict[str, Any], allowed: frozenset[str]) -> None:
    unsupported = sorted(set(values) - allowed)
    if unsupported:
        raise NotebookValidationError({"fields": f"Cannot be set: {', '.join(unsupported)}."})


BLOCK_EXECUTION_INPUT_FIELDS = frozenset({"content", "prompt", "config"})


class NotebookServiceError(Exception):
    pass


class NotebookValidationError(NotebookServiceError):
    def __init__(self, errors: dict[str, Any]):
        super().__init__(str(errors))
        self.errors = errors


class NotebookConflictError(NotebookServiceError):
    pass


class NotebookSourceNotFound(NotebookServiceError):
    pass


def _validate_project_ids(organization_id: int, project_ids: Iterable[int]) -> list[int]:
    requested = sorted(set(project_ids))
    if not requested:
        return requested
    known = set(
        Project.objects.filter(
            id__in=requested, organization_id=organization_id, status=ObjectStatus.ACTIVE
        ).values_list("id", flat=True)
    )
    if not set(requested).issubset(known):
        raise NotebookValidationError({"projectIds": "One or more projects are inaccessible."})
    return requested


def _create_project_links(notebook: Notebook, project_ids: Iterable[int]) -> None:
    requested = _validate_project_ids(notebook.organization_id, project_ids)
    NotebookProject.objects.bulk_create(
        [NotebookProject(notebook=notebook, project_id=project_id) for project_id in requested]
    )


def create_manual_notebook(
    *,
    organization: Organization,
    creator: CreatorReference,
    title: str,
    project_ids: list[int],
    filters: dict[str, Any],
) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        notebook = Notebook.objects.create(
            organization=organization,
            **creator,
            title=title,
            filters=filters,
        )
        _create_project_links(notebook, project_ids)
    return notebook


def create_notebook(
    *,
    organization: Organization,
    created_by_id: int | None,
    created_by_service_account_id: int | None,
    title: str,
    source_type: str,
    source_key: str | None,
    source: dict[str, Any],
    source_revision: int | None,
    filters: dict[str, Any],
    project_ids: list[int],
) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        notebook = Notebook.objects.create(
            organization=organization,
            created_by_id=created_by_id,
            created_by_service_account_id=created_by_service_account_id,
            title=title,
            source_type=source_type,
            source_key=source_key,
            source=deepcopy(source),
            source_revision=source_revision,
            filters=deepcopy(filters),
        )
        _create_project_links(notebook, project_ids)
    return notebook


def _copy_title(title: str) -> str:
    prefix = "Copy of "
    return prefix + title[: MAX_NOTEBOOK_TITLE_LENGTH - len(prefix)]


def duplicate_notebook(*, notebook: Notebook, creator: CreatorReference) -> Notebook:
    """Copy notebook structure without executions, comments, or collaboration state."""

    user_id = creator["created_by_id"]

    with transaction.atomic(using=router.db_for_write(Notebook)):
        try:
            source = Notebook.objects.select_for_update().get(id=notebook.id)
        except Notebook.DoesNotExist:
            raise NotebookSourceNotFound
        duplicate = Notebook.objects.create(
            organization=source.organization,
            **creator,
            title=_copy_title(source.title),
            filters=deepcopy(source.filters),
        )
        _create_project_links(
            duplicate,
            source.project_links.values_list("project_id", flat=True),
        )

        for block in source.blocks.filter(deleted_at__isnull=True).order_by("position", "id"):
            NotebookBlock.objects.create(
                notebook=duplicate,
                created_by_id=user_id,
                last_edited_by_id=user_id,
                position=block.position,
                kind=block.kind,
                title=block.title,
                content="" if block.content_execution_id else block.content,
                prompt=block.prompt,
                generated_content="" if block.content_execution_id else block.generated_content,
                config=deepcopy(block.config),
                display=deepcopy(block.display),
            )

    return duplicate


def lock_notebook(notebook: Notebook, expected_version: int) -> Notebook:
    """Lock the aggregate root before subordinate rows in an Investigation-routed transaction."""
    try:
        locked = Notebook.objects.select_for_update().get(id=notebook.id)
    except Notebook.DoesNotExist:
        raise NotebookSourceNotFound
    if locked.version != expected_version:
        raise NotebookConflictError("Investigation has changed.")
    return locked


def bump_notebook_version(notebook: Notebook) -> None:
    notebook.version += 1
    notebook.save()


def update_notebook(
    *,
    notebook: Notebook,
    expected_version: int,
    fields: dict[str, Any],
    project_ids: list[int] | None,
) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = lock_notebook(notebook, expected_version)
        restoring_source_notebook = (
            locked.status == NotebookStatus.ARCHIVED
            and fields.get("status") == NotebookStatus.ACTIVE
            and locked.source_key is not None
        )
        if restoring_source_notebook:
            raise NotebookConflictError(
                "Archived source investigations cannot be reactivated; create a new revision."
            )
        unsupported = sorted(set(fields) - UPDATABLE_NOTEBOOK_FIELDS)
        if unsupported:
            raise NotebookValidationError(
                {"fields": f"Cannot be updated: {', '.join(unsupported)}."}
            )
        for field, value in fields.items():
            setattr(locked, field, value)
        if project_ids is not None:
            NotebookProject.objects.filter(notebook=locked).delete()
            _create_project_links(locked, project_ids)
        bump_notebook_version(locked)
    return locked


def archive_notebook(*, notebook: Notebook, expected_version: int) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = lock_notebook(notebook, expected_version)
        if locked.status == NotebookStatus.ARCHIVED:
            return locked
        if NotebookBlockExecution.objects.filter(
            block__notebook=locked,
            block__deleted_at__isnull=True,
            status__in=(
                NotebookBlockExecutionStatus.PENDING,
                NotebookBlockExecutionStatus.RUNNING,
                NotebookBlockExecutionStatus.AWAITING_INPUT,
                NotebookBlockExecutionStatus.STOPPING,
            ),
        ).exists():
            raise NotebookValidationError(
                {"detail": "Stop active block runs before archiving this investigation."}
            )
        locked.status = NotebookStatus.ARCHIVED
        bump_notebook_version(locked)
    return locked


def create_block(
    *,
    notebook: Notebook,
    expected_notebook_version: int,
    user_id: int,
    values: dict[str, Any],
) -> NotebookBlock:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = lock_notebook(notebook, expected_notebook_version)
        if locked.status != NotebookStatus.ACTIVE:
            raise NotebookValidationError({"detail": "Archived investigations are read-only."})
        _reject_unsupported_fields(values, CREATABLE_BLOCK_FIELDS)
        maximum = NotebookBlock.objects.filter(notebook=locked, deleted_at__isnull=True).aggregate(
            maximum=Max("position")
        )["maximum"]
        position = 0 if maximum is None else maximum + 1
        block = NotebookBlock.objects.create(
            notebook=locked,
            created_by_id=user_id,
            last_edited_by_id=user_id,
            position=position,
            **values,
        )
        bump_notebook_version(locked)
    return block


def update_block(
    *,
    block: NotebookBlock,
    expected_notebook_version: int,
    expected_block_version: int,
    user_id: int,
    values: dict[str, Any],
) -> NotebookBlock:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        notebook = lock_notebook(block.notebook, expected_notebook_version)
        try:
            locked = NotebookBlock.objects.select_for_update().get(id=block.id)
        except NotebookBlock.DoesNotExist:
            raise NotebookSourceNotFound
        if notebook.status != NotebookStatus.ACTIVE:
            raise NotebookValidationError({"detail": "Archived investigations are read-only."})
        if locked.version != expected_block_version:
            raise NotebookConflictError("Block has changed.")
        _reject_unsupported_fields(values, UPDATABLE_BLOCK_FIELDS)
        changed_values = {
            field: value for field, value in values.items() if getattr(locked, field) != value
        }
        if not changed_values:
            return locked

        inputs_changed = bool(BLOCK_EXECUTION_INPUT_FIELDS.intersection(changed_values))
        if inputs_changed:
            locked.stale_at = timezone.now()
        for field, value in changed_values.items():
            setattr(locked, field, value)
        locked.last_edited_by_id = user_id
        locked.version += 1
        locked.save()
        bump_notebook_version(notebook)
    return locked


def delete_block(
    *, block: NotebookBlock, expected_notebook_version: int, expected_block_version: int
) -> None:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        notebook = lock_notebook(block.notebook, expected_notebook_version)
        try:
            locked = NotebookBlock.objects.select_for_update().get(id=block.id)
        except NotebookBlock.DoesNotExist:
            raise NotebookSourceNotFound
        if notebook.status != NotebookStatus.ACTIVE:
            raise NotebookValidationError({"detail": "Archived investigations are read-only."})
        if locked.version != expected_block_version:
            raise NotebookConflictError("Block has changed.")
        if locked.executions.filter(
            status__in=(
                NotebookBlockExecutionStatus.PENDING,
                NotebookBlockExecutionStatus.RUNNING,
                NotebookBlockExecutionStatus.AWAITING_INPUT,
                NotebookBlockExecutionStatus.STOPPING,
            )
        ).exists():
            raise NotebookValidationError(
                {"detail": "Stop the active run before deleting this block."}
            )
        locked.deleted_at = timezone.now()
        locked.version += 1
        locked.save(update_fields=["deleted_at", "version", "date_updated"])
        active_blocks = list(
            NotebookBlock.objects.select_for_update()
            .filter(notebook=notebook, deleted_at__isnull=True)
            .order_by("position", "id")
        )
        for position, active_block in enumerate(active_blocks):
            active_block.position = position
        NotebookBlock.objects.bulk_update(active_blocks, ["position"])
        bump_notebook_version(notebook)


def reorder_blocks(*, notebook: Notebook, expected_version: int, block_ids: list[int]) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = lock_notebook(notebook, expected_version)
        if locked.status != NotebookStatus.ACTIVE:
            raise NotebookValidationError({"detail": "Archived investigations are read-only."})
        blocks = list(
            NotebookBlock.objects.select_for_update().filter(
                notebook=locked, deleted_at__isnull=True
            )
        )
        existing = {block.id: block for block in blocks}
        if len(block_ids) != len(set(block_ids)):
            raise NotebookValidationError({"blockIds": "Block IDs must be unique."})
        if set(block_ids) != set(existing):
            raise NotebookValidationError(
                {"blockIds": "Must contain every active block exactly once."}
            )
        ordered = [existing[block_id] for block_id in block_ids]
        for position, block in enumerate(ordered):
            block.position = position
        NotebookBlock.objects.bulk_update(ordered, ["position"])
        bump_notebook_version(locked)
    return locked
