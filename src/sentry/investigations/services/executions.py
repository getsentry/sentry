from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from django.db import router, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from sentry.investigations.contracts import validate_query_result
from sentry.investigations.models import (
    TERMINAL_BLOCK_EXECUTION_STATUSES,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationBlockKind,
    InvestigationParameterType,
    InvestigationStatus,
)
from sentry.investigations.services.investigations import (
    InvestigationConflictError,
    InvestigationValidationError,
    investigation_filters,
    investigation_source,
    lock_investigation,
)
from sentry.investigations.services.parameters import (
    ParameterValidationError,
    validate_parameter_value,
)
from sentry.models.project import Project
from sentry.utils import json

MAX_CONTEXT_BLOCKS = 20
MAX_CONTEXT_TEXT_CHARS = 50_000
MAX_CONTEXT_BYTES = 512 * 1024
DISPATCH_CLAIM_TIMEOUT = timedelta(minutes=5)


def _fingerprint(snapshot: dict[str, Any]) -> str:
    serialized = json.dumps(snapshot, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


def _compact_query_context(
    result: Any, *, max_text_chars: int = MAX_CONTEXT_TEXT_CHARS
) -> dict[str, Any]:
    try:
        validated = validate_query_result(result)
    except ValidationError:
        raise InvestigationValidationError(
            {"context": "A query context block has no usable result."}
        )
    return {
        "schemaVersion": validated["schemaVersion"],
        "tableMarkdown": validated["tableMarkdown"][:max_text_chars],
        "chart": validated.get("chart"),
        "preferredView": validated["preferredView"],
        "isEmpty": validated["isEmpty"],
        "chartUnavailableReason": validated.get("chartUnavailableReason"),
        "queryLinks": validated["queryLinks"],
    }


def _has_usable_query_data(result: Any) -> bool:
    try:
        validated = validate_query_result(result)
    except ValidationError:
        return False
    return not validated["isEmpty"] and bool(
        validated.get("chart") or validated["tableMarkdown"].strip()
    )


def _query_refinement_context_execution(
    block: InvestigationBlock,
) -> InvestigationBlockExecution | None:
    current = block.result_execution
    if current is not None and _has_usable_query_data(current.result):
        return current

    completed = block.executions.filter(status=InvestigationBlockExecutionStatus.COMPLETED)
    if current is not None:
        assert current.id is not None
        completed = completed.exclude(id=current.id)
    for execution in completed.order_by("-date_added")[:20]:
        if _has_usable_query_data(execution.result):
            return execution
    return current


def _materialize_dependency_context(
    block: InvestigationBlock, *, accessible_project_ids: set[int]
) -> tuple[dict[str, str | None], list[dict[str, Any]], list[int]]:
    links = list(
        block.dependency_links.select_related(
            "depends_on__content_execution",
            "depends_on__result_execution",
        )
        .prefetch_related(
            "depends_on__content_execution__data_projects",
            "depends_on__result_execution__data_projects",
        )
        .order_by("depends_on__position", "depends_on__id")
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
        if dependency.deleted_at is not None:
            raise InvestigationValidationError(
                {"context": "A selected context block has been deleted."}
            )
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
                project.id for project in dependency_execution.data_projects.all()
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
        .prefetch_related(
            "content_execution__data_projects",
            "result_execution__data_projects",
        )
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
            ):
                item["result"] = _compact_query_context(
                    visible_execution.result, max_text_chars=max_text_chars
                )
        else:
            item["content"] = context_block.content[:max_text_chars]

        if visible_execution is not None:
            represented_project_ids = set(
                project.id for project in visible_execution.data_projects.all()
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
    projects: list[Project],
    accessible_project_ids: set[int],
) -> tuple[dict[str, Any], str]:
    dataset_hint = None
    if block.kind == InvestigationBlockKind.QUERY:
        dataset_hint = block.config.get("datasetHint")
        if dataset_hint is not None and dataset_hint not in {
            "errors",
            "issues",
            "spans",
            "logs",
            "metrics",
        }:
            raise InvestigationValidationError({"detail": "The template dataset hint is invalid."})

    prompt = (block.prompt or block.content).strip()
    parameters: dict[str, Any] = {}
    for link in block.parameter_links.select_related("parameter").order_by("parameter__key"):
        parameter = link.parameter
        value = parameter.saved_value
        if value is not None and parameter.type in {
            InvestigationParameterType.PROJECT,
            InvestigationParameterType.PROJECT_LIST,
        }:
            try:
                value = validate_parameter_value(
                    parameter_type=parameter.type,
                    value=value,
                    constraints=parameter.validation_constraints,
                    accessible_project_ids=accessible_project_ids,
                )
            except ParameterValidationError as error:
                raise InvestigationValidationError({"parameters": {parameter.key: str(error)}})
        parameters[parameter.key] = value
    if block.kind == InvestigationBlockKind.TEXT:
        dependencies, context, context_project_ids = _materialize_notebook_context(
            block, accessible_project_ids=accessible_project_ids
        )
    else:
        dependencies, context, context_project_ids = _materialize_dependency_context(
            block, accessible_project_ids=accessible_project_ids
        )
        previous_execution = _query_refinement_context_execution(block)
        if (
            previous_execution is not None
            and previous_execution.status == InvestigationBlockExecutionStatus.COMPLETED
        ):
            previous_project_ids = set(
                previous_execution.data_projects.values_list("id", flat=True)
            )
            if not previous_project_ids.issubset(accessible_project_ids):
                raise InvestigationValidationError(
                    {"context": "The previous query result uses inaccessible project data."}
                )
            context.insert(
                0,
                {
                    "block_id": str(block.id),
                    "kind": block.kind,
                    "title": block.title,
                    "currentBlock": True,
                    "visibleExecutionId": str(previous_execution.id),
                    "result": _compact_query_context(previous_execution.result),
                },
            )
            context_project_ids = sorted(set(context_project_ids).union(previous_project_ids))
            if len(json.dumps(context).encode()) > MAX_CONTEXT_BYTES:
                raise InvestigationValidationError(
                    {"context": "The query context is too large to send to the agent."}
                )
    snapshot: dict[str, Any] = {
        "prompt": prompt,
        "organizationSlug": block.investigation.organization.slug,
        "source": investigation_source(block.investigation),
        "filters": investigation_filters(block.investigation),
        "parameters": parameters,
        "dependencies": dependencies,
        "context": context,
        "contextDataProjectIds": context_project_ids,
        "projectIds": [project.id for project in projects],
        "projectSlugs": [project.slug for project in projects],
        "blockVersion": block.version,
        "investigationVersion": block.investigation.version,
    }
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
    accessible_project_ids: set[int],
    request_id: UUID | None = None,
) -> tuple[InvestigationBlockExecution, bool]:
    """Create a new immutable execution, or return the same explicit request retry."""
    if request_id is not None:
        requested_execution = InvestigationBlockExecution.objects.filter(
            request_id=request_id
        ).first()
        if requested_execution is not None:
            if requested_execution.block_id != block.id:
                raise InvestigationValidationError(
                    {"requestId": "This execution request ID is already in use."}
                )
            return requested_execution, False

    database = router.db_for_write(InvestigationBlockExecution)
    with transaction.atomic(using=database):
        locked_investigation = lock_investigation(
            block.investigation, expected_investigation_version
        )
        locked = (
            InvestigationBlock.objects.select_for_update(of=("self",))
            .select_related("current_execution")
            .get(id=block.id, investigation=locked_investigation)
        )
        locked.investigation = locked_investigation
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
        if len(project_ids) != len(set(project_ids)):
            raise InvestigationValidationError({"detail": "Invalid project scope."})
        if not set(project_ids).issubset(accessible_project_ids):
            raise InvestigationValidationError({"detail": "One or more projects are inaccessible."})
        projects = list(
            Project.objects.filter(
                organization_id=locked_investigation.organization_id,
                id__in=project_ids,
            ).order_by("id")
        )
        if len(projects) != len(project_ids):
            raise InvestigationValidationError({"detail": "Invalid project scope."})

        snapshot, fingerprint = build_block_execution_snapshot(
            block=locked,
            projects=projects,
            accessible_project_ids=accessible_project_ids,
        )
        if request_id is None and (current := locked.current_execution) is not None:
            current.refresh_from_db(fields=["status"])
            if (
                current.block_version == locked.version
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
        if request_id is None:
            execution = InvestigationBlockExecution.objects.create(**execution_values)
        else:
            execution, created = InvestigationBlockExecution.objects.get_or_create(
                request_id=request_id,
                defaults=execution_values,
            )
            if not created:
                if execution.block_id != locked.id:
                    raise InvestigationValidationError(
                        {"requestId": "This execution request ID is already in use."}
                    )
                return execution, False
        locked.current_execution = execution
        locked.save(update_fields=["current_execution", "date_updated"])
        return execution, True


def mark_block_execution_dispatched(
    execution: InvestigationBlockExecution,
    *,
    seer_run_id: int,
    dispatch_claimed_at: datetime | None = None,
) -> bool:
    candidates = InvestigationBlockExecution.objects.filter(id=execution.id)
    if dispatch_claimed_at is None:
        candidates = candidates.filter(status=InvestigationBlockExecutionStatus.PENDING)
    else:
        candidates = candidates.filter(
            status=InvestigationBlockExecutionStatus.RUNNING,
            seer_run_id__isnull=True,
            started_at=dispatch_claimed_at,
        )
    updated = candidates.update(
        seer_run_id=seer_run_id,
        status=InvestigationBlockExecutionStatus.RUNNING,
        started_at=dispatch_claimed_at or timezone.now(),
    )
    return updated == 1


def mark_block_execution_dispatch_started(
    execution: InvestigationBlockExecution,
) -> datetime | None:
    stale_before = timezone.now() - DISPATCH_CLAIM_TIMEOUT
    claimed_at = timezone.now()
    updated = (
        InvestigationBlockExecution.objects.filter(id=execution.id)
        .filter(
            Q(status=InvestigationBlockExecutionStatus.PENDING)
            | Q(
                status=InvestigationBlockExecutionStatus.RUNNING,
                seer_run_id__isnull=True,
                started_at__lte=stale_before,
            )
            | Q(
                status=InvestigationBlockExecutionStatus.RUNNING,
                seer_run_id__isnull=True,
                started_at__isnull=True,
            )
        )
        .update(
            status=InvestigationBlockExecutionStatus.RUNNING,
            started_at=claimed_at,
        )
    )
    return claimed_at if updated == 1 else None


def block_execution_needs_dispatch(execution: InvestigationBlockExecution) -> bool:
    if execution.status == InvestigationBlockExecutionStatus.PENDING:
        return True
    return (
        execution.status == InvestigationBlockExecutionStatus.RUNNING
        and execution.seer_run_id is None
        and (
            execution.started_at is None
            or execution.started_at <= timezone.now() - DISPATCH_CLAIM_TIMEOUT
        )
    )


def mark_block_execution_resumed(execution: InvestigationBlockExecution) -> bool:
    updated = InvestigationBlockExecution.objects.filter(
        id=execution.id, status=InvestigationBlockExecutionStatus.AWAITING_INPUT
    ).update(status=InvestigationBlockExecutionStatus.RUNNING)
    return updated == 1


def mark_block_execution_stopping(execution: InvestigationBlockExecution) -> bool:
    updated = (
        InvestigationBlockExecution.objects.filter(id=execution.id)
        .exclude(status__in=TERMINAL_BLOCK_EXECUTION_STATUSES)
        .update(status=InvestigationBlockExecutionStatus.STOPPING)
    )
    return updated == 1


def mark_block_execution_cancelled(execution: InvestigationBlockExecution) -> bool:
    updated = (
        InvestigationBlockExecution.objects.filter(id=execution.id)
        .exclude(status__in=TERMINAL_BLOCK_EXECUTION_STATUSES)
        .update(status=InvestigationBlockExecutionStatus.CANCELLED, completed_at=timezone.now())
    )
    return updated == 1


def mark_block_execution_dispatch_failed(
    execution: InvestigationBlockExecution, *, dispatch_claimed_at: datetime | None = None
) -> bool:
    candidates = InvestigationBlockExecution.objects.filter(id=execution.id)
    if dispatch_claimed_at is None:
        candidates = candidates.filter(
            status__in=[
                InvestigationBlockExecutionStatus.PENDING,
                InvestigationBlockExecutionStatus.RUNNING,
            ],
            seer_run_id__isnull=True,
        )
    else:
        candidates = candidates.filter(
            status=InvestigationBlockExecutionStatus.RUNNING,
            seer_run_id__isnull=True,
            started_at=dispatch_claimed_at,
        )
    updated = candidates.update(
        status=InvestigationBlockExecutionStatus.FAILED,
        error={
            "code": "dispatch_failed",
            "message": "The execution could not be started.",
        },
        completed_at=timezone.now(),
    )
    return updated == 1
