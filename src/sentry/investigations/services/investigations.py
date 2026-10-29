from __future__ import annotations

from collections.abc import Iterable
from collections.abc import Set as AbstractSet
from copy import deepcopy
from typing import Any

from django.db import router, transaction
from django.db.models import Max
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.db.models.fields.bounded import I64_MAX
from sentry.investigations.services.breached_metrics import (
    BreachedMetricSource,
    resolve_breached_metric_sources,
)
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

UPDATABLE_INVESTIGATION_FIELDS = frozenset({"title", "status", "filters"})
MAX_INVESTIGATION_TITLE_LENGTH = 255
# Placeholder used before titles were derived from the investigation type.
DEFAULT_INVESTIGATION_TITLE = "Untitled investigation"

CREATABLE_BLOCK_FIELDS = frozenset({"kind", "title", "content", "prompt", "config", "display"})
UPDATABLE_BLOCK_FIELDS = CREATABLE_BLOCK_FIELDS - {"kind"}


_INVESTIGATION_TYPE_LABELS: dict[str, str] = {
    NotebookSourceType.MANUAL: "manual",
    NotebookSourceType.METRIC_OPEN_PERIOD: "breached metrics",
}


def default_investigation_title(source_type: str) -> str:
    """Placeholder title shown until Seer names the investigation."""

    label = _INVESTIGATION_TYPE_LABELS.get(source_type, "manual")
    return f"New {label} investigation"


def has_default_investigation_title(investigation: Notebook) -> bool:
    return investigation.title in {
        DEFAULT_INVESTIGATION_TITLE,
        default_investigation_title(investigation.source_type),
    }


def _reject_unsupported_fields(values: dict[str, Any], allowed: frozenset[str]) -> None:
    unsupported = sorted(set(values) - allowed)
    if unsupported:
        raise InvestigationValidationError({"fields": f"Cannot be set: {', '.join(unsupported)}."})


BLOCK_EXECUTION_INPUT_FIELDS = frozenset({"content", "prompt", "config"})


class InvestigationServiceError(Exception):
    pass


class InvestigationValidationError(InvestigationServiceError):
    def __init__(self, errors: dict[str, Any]):
        super().__init__(str(errors))
        self.errors = errors


class InvestigationConflictError(InvestigationServiceError):
    pass


class InvestigationSourceNotFound(InvestigationServiceError):
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
        raise InvestigationValidationError({"projectIds": "One or more projects are inaccessible."})
    return requested


def _create_project_links(investigation: Notebook, project_ids: Iterable[int]) -> None:
    requested = _validate_project_ids(investigation.organization_id, project_ids)
    NotebookProject.objects.bulk_create(
        [NotebookProject(notebook=investigation, project_id=project_id) for project_id in requested]
    )


def create_manual_investigation(
    *,
    organization: Organization,
    user_id: int,
    title: str,
    project_ids: list[int],
    filters: dict[str, Any],
) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        investigation = Notebook.objects.create(
            organization=organization,
            created_by_id=user_id,
            title=title,
            filters=filters,
        )
        _create_project_links(investigation, project_ids)
    return investigation


def _copy_title(title: str) -> str:
    prefix = "Copy of "
    return prefix + title[: MAX_INVESTIGATION_TITLE_LENGTH - len(prefix)]


def duplicate_investigation(*, investigation: Notebook, user_id: int) -> Notebook:
    """Copy notebook structure without executions, comments, or collaboration state."""

    with transaction.atomic(using=router.db_for_write(Notebook)):
        try:
            source = Notebook.objects.select_for_update().get(id=investigation.id)
        except Notebook.DoesNotExist:
            raise InvestigationSourceNotFound
        duplicate = Notebook.objects.create(
            organization=source.organization,
            created_by_id=user_id,
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


def _metric_open_period_ref(source: dict[str, Any]) -> tuple[int, int]:
    if source.get("type") != "metric_open_period":
        raise InvestigationValidationError({"source": "Unsupported investigation source."})
    source_ref = source.get("ref")
    if not isinstance(source_ref, dict) or set(source_ref) != {"groupId", "openPeriodId"}:
        raise InvestigationValidationError(
            {"source": "metric_open_period requires groupId and openPeriodId."}
        )
    group_id = source_ref["groupId"]
    open_period_id = source_ref["openPeriodId"]
    if (
        isinstance(group_id, bool)
        or not isinstance(group_id, int | str)
        or isinstance(open_period_id, bool)
        or not isinstance(open_period_id, int | str)
    ):
        raise InvestigationValidationError({"source": "groupId and openPeriodId must be IDs."})
    try:
        normalized_ref = int(group_id), int(open_period_id)
    except (TypeError, ValueError):
        raise InvestigationSourceNotFound
    if any(not 0 < value <= I64_MAX for value in normalized_ref):
        raise InvestigationSourceNotFound
    return normalized_ref


def resolve_investigation_sources(
    *,
    organization: Organization,
    sources: list[dict[str, Any]],
    accessible_project_ids: AbstractSet[int],
) -> list[BreachedMetricSource | None]:
    refs = [_metric_open_period_ref(source) for source in sources]
    resolved = resolve_breached_metric_sources(
        organization=organization,
        source_refs=refs,
        accessible_project_ids=accessible_project_ids,
    )
    return [resolved.get(source_ref) for source_ref in refs]


def resolve_investigation_source(
    *,
    organization: Organization,
    source: dict[str, Any],
    accessible_project_ids: AbstractSet[int],
) -> BreachedMetricSource:
    resolved = resolve_investigation_sources(
        organization=organization,
        sources=[source],
        accessible_project_ids=accessible_project_ids,
    )[0]
    if resolved is None:
        raise InvestigationSourceNotFound
    return resolved


def lock_investigation(investigation: Notebook, expected_version: int) -> Notebook:
    """Lock the aggregate root before subordinate rows in an Investigation-routed transaction."""
    try:
        locked = Notebook.objects.select_for_update().get(id=investigation.id)
    except Notebook.DoesNotExist:
        raise InvestigationSourceNotFound
    if locked.version != expected_version:
        raise InvestigationConflictError("Investigation has changed.")
    return locked


def bump_investigation_version(investigation: Notebook) -> None:
    investigation.version += 1
    investigation.save()


def update_investigation(
    *,
    investigation: Notebook,
    expected_version: int,
    fields: dict[str, Any],
    project_ids: list[int] | None,
) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = lock_investigation(investigation, expected_version)
        restoring_source_investigation = (
            locked.status == NotebookStatus.ARCHIVED
            and fields.get("status") == NotebookStatus.ACTIVE
            and locked.source_key is not None
        )
        if restoring_source_investigation:
            raise InvestigationConflictError(
                "Archived source investigations cannot be reactivated; create a new revision."
            )
        unsupported = sorted(set(fields) - UPDATABLE_INVESTIGATION_FIELDS)
        if unsupported:
            raise InvestigationValidationError(
                {"fields": f"Cannot be updated: {', '.join(unsupported)}."}
            )
        for field, value in fields.items():
            setattr(locked, field, value)
        if project_ids is not None:
            NotebookProject.objects.filter(notebook=locked).delete()
            _create_project_links(locked, project_ids)
        bump_investigation_version(locked)
    return locked


def archive_investigation(*, investigation: Notebook, expected_version: int) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = lock_investigation(investigation, expected_version)
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
            raise InvestigationValidationError(
                {"detail": "Stop active block runs before archiving this investigation."}
            )
        locked.status = NotebookStatus.ARCHIVED
        bump_investigation_version(locked)
    return locked


def create_block(
    *,
    investigation: Notebook,
    expected_investigation_version: int,
    user_id: int,
    values: dict[str, Any],
) -> NotebookBlock:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = lock_investigation(investigation, expected_investigation_version)
        if locked.status != NotebookStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
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
        bump_investigation_version(locked)
    return block


def update_block(
    *,
    block: NotebookBlock,
    expected_investigation_version: int,
    expected_block_version: int,
    user_id: int,
    values: dict[str, Any],
) -> NotebookBlock:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        investigation = lock_investigation(block.notebook, expected_investigation_version)
        try:
            locked = NotebookBlock.objects.select_for_update().get(id=block.id)
        except NotebookBlock.DoesNotExist:
            raise InvestigationSourceNotFound
        if investigation.status != NotebookStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        if locked.version != expected_block_version:
            raise InvestigationConflictError("Block has changed.")
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
        bump_investigation_version(investigation)
    return locked


def delete_block(
    *, block: NotebookBlock, expected_investigation_version: int, expected_block_version: int
) -> None:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        investigation = lock_investigation(block.notebook, expected_investigation_version)
        try:
            locked = NotebookBlock.objects.select_for_update().get(id=block.id)
        except NotebookBlock.DoesNotExist:
            raise InvestigationSourceNotFound
        if investigation.status != NotebookStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        if locked.version != expected_block_version:
            raise InvestigationConflictError("Block has changed.")
        if locked.executions.filter(
            status__in=(
                NotebookBlockExecutionStatus.PENDING,
                NotebookBlockExecutionStatus.RUNNING,
                NotebookBlockExecutionStatus.AWAITING_INPUT,
                NotebookBlockExecutionStatus.STOPPING,
            )
        ).exists():
            raise InvestigationValidationError(
                {"detail": "Stop the active run before deleting this block."}
            )
        locked.deleted_at = timezone.now()
        locked.version += 1
        locked.save(update_fields=["deleted_at", "version", "date_updated"])
        active_blocks = list(
            NotebookBlock.objects.select_for_update()
            .filter(notebook=investigation, deleted_at__isnull=True)
            .order_by("position", "id")
        )
        for position, active_block in enumerate(active_blocks):
            active_block.position = position
        NotebookBlock.objects.bulk_update(active_blocks, ["position"])
        bump_investigation_version(investigation)


def reorder_blocks(
    *, investigation: Notebook, expected_version: int, block_ids: list[int]
) -> Notebook:
    with transaction.atomic(using=router.db_for_write(Notebook)):
        locked = lock_investigation(investigation, expected_version)
        if locked.status != NotebookStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        blocks = list(
            NotebookBlock.objects.select_for_update().filter(
                notebook=locked, deleted_at__isnull=True
            )
        )
        existing = {block.id: block for block in blocks}
        if len(block_ids) != len(set(block_ids)):
            raise InvestigationValidationError({"blockIds": "Block IDs must be unique."})
        if set(block_ids) != set(existing):
            raise InvestigationValidationError(
                {"blockIds": "Must contain every active block exactly once."}
            )
        ordered = [existing[block_id] for block_id in block_ids]
        for position, block in enumerate(ordered):
            block.position = position
        NotebookBlock.objects.bulk_update(ordered, ["position"])
        bump_investigation_version(locked)
    return locked
