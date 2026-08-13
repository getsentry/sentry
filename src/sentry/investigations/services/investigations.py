from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Iterable
from collections.abc import Set as AbstractSet
from copy import deepcopy
from typing import Any

from django.db import IntegrityError, router, transaction
from django.db.models import F, Max
from django.utils import timezone

from sentry.db.models.fields.bounded import I64_MAX
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockDependency,
    InvestigationBlockParameter,
    InvestigationParameter,
    InvestigationParameterSource,
    InvestigationProject,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services.breached_metrics import (
    BreachedMetricSource,
    resolve_breached_metric_sources,
)
from sentry.investigations.services.parameters import (
    ParameterValidationError,
    validate_parameter_value,
    validate_template_parameters,
)
from sentry.investigations.templates import InvestigationTemplateSpec, get_investigation_template
from sentry.models.organization import Organization
from sentry.models.project import Project

UPDATABLE_INVESTIGATION_FIELDS = frozenset({"title", "status", "filters"})
MAX_INVESTIGATION_TITLE_LENGTH = 255

CREATABLE_BLOCK_FIELDS = frozenset({"kind", "title", "content", "prompt", "config", "display"})
UPDATABLE_BLOCK_FIELDS = CREATABLE_BLOCK_FIELDS - {"kind"}


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


def _validate_template_graph(template: InvestigationTemplateSpec) -> None:
    block_keys = {block.key for block in template.blocks}
    if len(block_keys) != len(template.blocks):
        raise InvestigationValidationError({"templateKey": "Template contains duplicate blocks."})

    parameter_keys = {parameter.key for parameter in template.parameters}
    incoming: dict[str, int] = {key: 0 for key in block_keys}
    dependents: dict[str, list[str]] = defaultdict(list)
    for block in template.blocks:
        unknown_dependencies = sorted(set(block.dependencies) - block_keys)
        if unknown_dependencies:
            raise InvestigationValidationError(
                {"templateKey": f"Block {block.key} has unknown dependencies."}
            )
        unknown_parameters = sorted(set(block.parameters) - parameter_keys)
        if unknown_parameters:
            raise InvestigationValidationError(
                {"templateKey": f"Block {block.key} has unknown parameters."}
            )
        if block.key in block.dependencies:
            raise InvestigationValidationError(
                {"templateKey": f"Block {block.key} cannot depend on itself."}
            )
        incoming[block.key] = len(block.dependencies)
        for dependency in block.dependencies:
            dependents[dependency].append(block.key)

    queue = deque(key for key, count in incoming.items() if count == 0)
    visited = 0
    while queue:
        key = queue.popleft()
        visited += 1
        for dependent in dependents[key]:
            incoming[dependent] -= 1
            if incoming[dependent] == 0:
                queue.append(dependent)
    if visited != len(block_keys):
        raise InvestigationValidationError(
            {"templateKey": "Template dependencies contain a cycle."}
        )


def _create_project_links(investigation: Investigation, project_ids: Iterable[int]) -> None:
    requested = sorted(set(project_ids))
    if not requested:
        return
    known = set(
        Project.objects.filter(
            id__in=requested, organization_id=investigation.organization_id
        ).values_list("id", flat=True)
    )
    unknown = [project_id for project_id in requested if project_id not in known]
    if unknown:
        raise InvestigationValidationError(
            {"projectIds": "One or more projects are not in this organization."}
        )
    InvestigationProject.objects.bulk_create(
        [
            InvestigationProject(investigation=investigation, project_id=project_id)
            for project_id in requested
        ]
    )


def create_manual_investigation(
    *,
    organization: Organization,
    user_id: int,
    title: str,
    project_ids: list[int],
    filters: dict[str, Any],
) -> Investigation:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        investigation = Investigation.objects.create(
            organization=organization,
            created_by_id=user_id,
            title=title,
            source_type=InvestigationSourceType.MANUAL,
            filters=filters,
        )
        _create_project_links(investigation, project_ids)
    return investigation


def _copy_title(title: str) -> str:
    prefix = "Copy of "
    return prefix + title[: MAX_INVESTIGATION_TITLE_LENGTH - len(prefix)]


def duplicate_investigation(*, investigation: Investigation, user_id: int) -> Investigation:
    """Copy notebook structure without executions, comments, or collaboration state."""

    with transaction.atomic(using=router.db_for_write(Investigation)):
        try:
            source = Investigation.objects.select_for_update().get(id=investigation.id)
        except Investigation.DoesNotExist:
            raise InvestigationSourceNotFound
        duplicate = Investigation.objects.create(
            organization=source.organization,
            created_by_id=user_id,
            title=_copy_title(source.title),
            template_key=source.template_key,
            template_version=source.template_version,
            source_type=InvestigationSourceType.MANUAL,
            source_ref={},
            filters=deepcopy(source.filters),
        )
        _create_project_links(
            duplicate,
            source.project_links.values_list("project_id", flat=True),
        )

        parameters_by_id: dict[int, InvestigationParameter] = {}
        for parameter in source.parameters.order_by("position", "id"):
            copied_parameter = InvestigationParameter.objects.create(
                investigation=duplicate,
                key=parameter.key,
                label=parameter.label,
                description=parameter.description,
                type=parameter.type,
                required=parameter.required,
                validation_constraints=deepcopy(parameter.validation_constraints),
                default_value=deepcopy(parameter.default_value),
                saved_value=deepcopy(parameter.saved_value),
                source=parameter.source,
                position=parameter.position,
            )
            parameters_by_id[parameter.id] = copied_parameter

        blocks_by_id: dict[int, InvestigationBlock] = {}
        source_blocks = list(
            source.blocks.filter(deleted_at__isnull=True).order_by("position", "id")
        )
        for block in source_blocks:
            copied_block = InvestigationBlock.objects.create(
                investigation=duplicate,
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
            blocks_by_id[block.id] = copied_block

        InvestigationBlockParameter.objects.bulk_create(
            [
                InvestigationBlockParameter(
                    block=blocks_by_id[link.block_id],
                    parameter=parameters_by_id[link.parameter_id],
                )
                for link in InvestigationBlockParameter.objects.filter(
                    block_id__in=blocks_by_id, parameter_id__in=parameters_by_id
                )
            ]
        )
        InvestigationBlockDependency.objects.bulk_create(
            [
                InvestigationBlockDependency(
                    block=blocks_by_id[link.block_id],
                    depends_on=blocks_by_id[link.depends_on_id],
                )
                for link in InvestigationBlockDependency.objects.filter(
                    block_id__in=blocks_by_id,
                    depends_on_id__in=blocks_by_id,
                )
            ]
        )

    return duplicate


def _resolve_breached_metric_source(
    *,
    organization: Organization,
    source_ref: dict[str, Any],
    accessible_project_ids: AbstractSet[int],
) -> BreachedMetricSource:
    if set(source_ref) != {"groupId", "openPeriodId"}:
        raise InvestigationValidationError(
            {"sourceRef": ("Must contain exactly groupId and openPeriodId for breached_metric.")}
        )
    group_id = source_ref["groupId"]
    open_period_id = source_ref["openPeriodId"]
    if (
        isinstance(group_id, bool)
        or not isinstance(group_id, int | str)
        or isinstance(open_period_id, bool)
        or not isinstance(open_period_id, int | str)
    ):
        raise InvestigationValidationError({"sourceRef": "groupId and openPeriodId must be IDs."})
    try:
        normalized_group_id = int(group_id)
        normalized_open_period_id = int(open_period_id)
    except (TypeError, ValueError):
        raise InvestigationSourceNotFound
    if not 0 < normalized_group_id <= I64_MAX or not 0 < normalized_open_period_id <= I64_MAX:
        raise InvestigationSourceNotFound
    source = resolve_breached_metric_sources(
        organization=organization,
        group_ids=[normalized_group_id],
        accessible_project_ids=accessible_project_ids,
    ).get(normalized_group_id)
    if source is None or source.open_period.id != normalized_open_period_id:
        raise InvestigationSourceNotFound
    return source


def create_template_investigation(
    *,
    organization: Organization,
    user_id: int,
    template_key: str,
    template_version: int,
    source_ref: dict[str, Any],
    supplied_parameters: dict[str, Any],
    accessible_project_ids: AbstractSet[int],
    title: str | None = None,
) -> Investigation:
    for attempt in range(3):
        try:
            return _create_template_investigation(
                organization=organization,
                user_id=user_id,
                template_key=template_key,
                template_version=template_version,
                source_ref=source_ref,
                supplied_parameters=supplied_parameters,
                accessible_project_ids=accessible_project_ids,
                title=title,
            )
        except IntegrityError:
            if attempt == 2:
                raise
    raise AssertionError("unreachable")


def _create_template_investigation(
    *,
    organization: Organization,
    user_id: int,
    template_key: str,
    template_version: int,
    source_ref: dict[str, Any],
    supplied_parameters: dict[str, Any],
    accessible_project_ids: AbstractSet[int],
    title: str | None = None,
) -> Investigation:
    template = get_investigation_template(template_key, template_version)
    if template is None:
        raise InvestigationValidationError(
            {"templateKey": "Unknown investigation template or version."}
        )
    _validate_template_graph(template)
    try:
        resolved_parameters = validate_template_parameters(
            template.parameters,
            supplied_parameters,
            accessible_project_ids=accessible_project_ids,
        )
    except ParameterValidationError as error:
        raise InvestigationValidationError({"parameters": str(error)})

    if template.source_type == InvestigationSourceType.BREACHED_METRIC:
        source = _resolve_breached_metric_source(
            organization=organization,
            source_ref=source_ref,
            accessible_project_ids=accessible_project_ids,
        )
        project_ids = [source.project_id]
        resolved_title = title or "Untitled investigation"
        normalized_source_ref = {
            "groupId": str(source.group.id),
            "openPeriodId": str(source.open_period.id),
        }
        source_key = source.source_key
        filters = {"breachedMetric": source.snapshot}
    else:
        raise InvestigationValidationError({"templateKey": "Unsupported template source."})

    with transaction.atomic(using=router.db_for_write(Investigation)):
        # Allocate revisions under an organization lock. The lineage/revision
        # uniqueness constraint remains the final guard for other writers.
        Organization.objects.select_for_update().get(id=organization.id)
        active = (
            Investigation.objects.select_for_update()
            .filter(
                organization=organization,
                source_type=template.source_type,
                source_key=source_key,
                status=InvestigationStatus.ACTIVE,
            )
            .order_by("-source_revision", "-id")
            .first()
        )
        if active is not None:
            return active
        latest_revision = Investigation.objects.filter(
            organization=organization,
            source_type=template.source_type,
            source_key=source_key,
        ).aggregate(latest=Max("source_revision"))["latest"]
        investigation = Investigation.objects.create(
            organization=organization,
            created_by_id=user_id,
            title=resolved_title,
            template_key=template.key,
            template_version=template.version,
            source_type=template.source_type,
            source_ref=normalized_source_ref,
            source_key=source_key,
            source_revision=(latest_revision or 0) + 1,
            filters=filters,
        )
        _create_project_links(investigation, project_ids)

        parameters_by_key: dict[str, InvestigationParameter] = {}
        for position, parameter_spec in enumerate(template.parameters):
            parameter = InvestigationParameter.objects.create(
                investigation=investigation,
                key=parameter_spec.key,
                label=parameter_spec.label,
                description=parameter_spec.description,
                type=parameter_spec.type,
                required=parameter_spec.required,
                validation_constraints=deepcopy(parameter_spec.constraints),
                default_value=deepcopy(parameter_spec.default_value),
                saved_value=deepcopy(resolved_parameters[parameter_spec.key]),
                source=InvestigationParameterSource.TEMPLATE,
                position=position,
            )
            parameters_by_key[parameter.key] = parameter

        blocks_by_key: dict[str, InvestigationBlock] = {}
        for position, block_spec in enumerate(template.blocks):
            block = InvestigationBlock.objects.create(
                investigation=investigation,
                created_by_id=user_id,
                last_edited_by_id=user_id,
                position=position,
                kind=block_spec.kind,
                title=block_spec.title,
                content=block_spec.content,
                prompt=block_spec.generation_prompt,
                generated_content=block_spec.generated_content,
                config={
                    **deepcopy(block_spec.config),
                    **({"datasetHint": source.dataset} if block_spec.kind == "query" else {}),
                },
                display=deepcopy(block_spec.display),
            )
            blocks_by_key[block_spec.key] = block
            InvestigationBlockParameter.objects.bulk_create(
                [
                    InvestigationBlockParameter(
                        block=block, parameter=parameters_by_key[parameter_key]
                    )
                    for parameter_key in block_spec.parameters
                ]
            )

        InvestigationBlockDependency.objects.bulk_create(
            [
                InvestigationBlockDependency(
                    block=blocks_by_key[block_spec.key],
                    depends_on=blocks_by_key[dependency_key],
                )
                for block_spec in template.blocks
                for dependency_key in block_spec.dependencies
            ]
        )

    return investigation


def lock_investigation(investigation: Investigation, expected_version: int) -> Investigation:
    """Lock the aggregate root before subordinate rows in an Investigation-routed transaction."""
    try:
        locked = Investigation.objects.select_for_update().get(id=investigation.id)
    except Investigation.DoesNotExist:
        raise InvestigationSourceNotFound
    if locked.version != expected_version:
        raise InvestigationConflictError("Investigation has changed.")
    return locked


def bump_investigation_version(investigation: Investigation) -> None:
    investigation.version += 1
    investigation.save()


def update_investigation(
    *,
    investigation: Investigation,
    expected_version: int,
    fields: dict[str, Any],
    project_ids: list[int] | None,
) -> Investigation:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        locked = lock_investigation(investigation, expected_version)
        restoring_source_investigation = (
            locked.status == InvestigationStatus.ARCHIVED
            and fields.get("status") == InvestigationStatus.ACTIVE
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
            InvestigationProject.objects.filter(investigation=locked).delete()
            _create_project_links(locked, project_ids)
        bump_investigation_version(locked)
    return locked


def archive_investigation(*, investigation: Investigation, expected_version: int) -> Investigation:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        locked = lock_investigation(investigation, expected_version)
        if locked.status == InvestigationStatus.ARCHIVED:
            return locked
        locked.status = InvestigationStatus.ARCHIVED
        bump_investigation_version(locked)
        if locked.source_key is not None:
            Investigation.objects.filter(
                organization=locked.organization,
                source_type=locked.source_type,
                source_key=locked.source_key,
            ).exclude(id=locked.id).update(
                status=InvestigationStatus.ARCHIVED, version=F("version") + 1
            )
    return locked


def create_block(
    *,
    investigation: Investigation,
    expected_investigation_version: int,
    user_id: int,
    values: dict[str, Any],
) -> InvestigationBlock:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        locked = lock_investigation(investigation, expected_investigation_version)
        if locked.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        _reject_unsupported_fields(values, CREATABLE_BLOCK_FIELDS)
        maximum = InvestigationBlock.objects.filter(
            investigation=locked, deleted_at__isnull=True
        ).aggregate(maximum=Max("position"))["maximum"]
        position = 0 if maximum is None else maximum + 1
        block = InvestigationBlock.objects.create(
            investigation=locked,
            created_by_id=user_id,
            last_edited_by_id=user_id,
            position=position,
            **values,
        )
        bump_investigation_version(locked)
    return block


def update_block(
    *,
    block: InvestigationBlock,
    expected_investigation_version: int,
    expected_block_version: int,
    user_id: int,
    values: dict[str, Any],
) -> InvestigationBlock:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        investigation = lock_investigation(block.investigation, expected_investigation_version)
        try:
            locked = InvestigationBlock.objects.select_for_update().get(id=block.id)
        except InvestigationBlock.DoesNotExist:
            raise InvestigationSourceNotFound
        if investigation.status != InvestigationStatus.ACTIVE:
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
        if inputs_changed:
            mark_downstream_blocks_stale(
                investigation_id=investigation.id, upstream_block_ids={locked.id}
            )
        bump_investigation_version(investigation)
    return locked


def mark_downstream_blocks_stale(
    *, investigation_id: int, upstream_block_ids: set[int]
) -> set[int]:
    dependent_edges = InvestigationBlockDependency.objects.filter(
        block__investigation_id=investigation_id,
        block__deleted_at__isnull=True,
        depends_on__deleted_at__isnull=True,
    ).values_list("depends_on_id", "block_id")
    dependents: dict[int, list[int]] = defaultdict(list)
    for upstream_id, dependent_id in dependent_edges:
        dependents[upstream_id].append(dependent_id)

    stale_ids: set[int] = set()
    queue = deque(upstream_block_ids)
    while queue:
        upstream_id = queue.popleft()
        for dependent_id in dependents[upstream_id]:
            if dependent_id not in stale_ids and dependent_id not in upstream_block_ids:
                stale_ids.add(dependent_id)
                queue.append(dependent_id)
    if stale_ids:
        InvestigationBlock.objects.filter(id__in=stale_ids).update(stale_at=timezone.now())
    return stale_ids


def delete_block(
    *, block: InvestigationBlock, expected_investigation_version: int, expected_block_version: int
) -> None:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        investigation = lock_investigation(block.investigation, expected_investigation_version)
        try:
            locked = InvestigationBlock.objects.select_for_update().get(id=block.id)
        except InvestigationBlock.DoesNotExist:
            raise InvestigationSourceNotFound
        if investigation.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        if locked.version != expected_block_version:
            raise InvestigationConflictError("Block has changed.")
        # Traverse before soft deletion because stale propagation only follows active endpoints.
        mark_downstream_blocks_stale(
            investigation_id=investigation.id, upstream_block_ids={locked.id}
        )
        locked.deleted_at = timezone.now()
        locked.version += 1
        locked.save(update_fields=["deleted_at", "version", "date_updated"])
        active_blocks = list(
            InvestigationBlock.objects.select_for_update()
            .filter(investigation=investigation, deleted_at__isnull=True)
            .order_by("position", "id")
        )
        for position, active_block in enumerate(active_blocks):
            active_block.position = position
        InvestigationBlock.objects.bulk_update(active_blocks, ["position"])
        bump_investigation_version(investigation)


def reorder_blocks(
    *, investigation: Investigation, expected_version: int, block_ids: list[int]
) -> Investigation:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        locked = lock_investigation(investigation, expected_version)
        if locked.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        blocks = list(
            InvestigationBlock.objects.select_for_update().filter(
                investigation=locked, deleted_at__isnull=True
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
        InvestigationBlock.objects.bulk_update(ordered, ["position"])
        bump_investigation_version(locked)
    return locked


def update_parameter_values(
    *,
    investigation: Investigation,
    expected_version: int,
    values: dict[str, Any],
    accessible_project_ids: AbstractSet[int],
) -> Investigation:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        locked = lock_investigation(investigation, expected_version)
        if locked.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        parameters = {
            parameter.key: parameter
            for parameter in InvestigationParameter.objects.select_for_update().filter(
                investigation=locked
            )
        }
        unknown = sorted(set(values) - set(parameters))
        if unknown:
            raise InvestigationValidationError(
                {"values": f"Unknown parameters: {', '.join(unknown)}."}
            )

        changed_parameter_ids: list[int] = []
        for key, value in values.items():
            parameter = parameters[key]
            if value is None:
                if parameter.required:
                    raise InvestigationValidationError(
                        {"values": {key: f"Missing required parameter: {key}."}}
                    )
                validated = None
            else:
                try:
                    validated = validate_parameter_value(
                        parameter_type=parameter.type,
                        value=value,
                        constraints=parameter.validation_constraints,
                        accessible_project_ids=accessible_project_ids,
                    )
                except ParameterValidationError as error:
                    raise InvestigationValidationError({"values": {key: str(error)}})
            if parameter.saved_value != validated:
                parameter.saved_value = validated
                parameter.version += 1
                parameter.save(update_fields=["saved_value", "version", "date_updated"])
                changed_parameter_ids.append(parameter.id)

        if changed_parameter_ids:
            directly_stale = set(
                InvestigationBlockParameter.objects.filter(
                    parameter_id__in=changed_parameter_ids,
                    block__investigation=locked,
                    block__deleted_at__isnull=True,
                ).values_list("block_id", flat=True)
            )
            dependent_edges = InvestigationBlockDependency.objects.filter(
                block__investigation=locked,
                block__deleted_at__isnull=True,
                depends_on__deleted_at__isnull=True,
            ).values_list("depends_on_id", "block_id")
            dependents: dict[int, list[int]] = defaultdict(list)
            for upstream_id, dependent_id in dependent_edges:
                dependents[upstream_id].append(dependent_id)
            stale_ids = set(directly_stale)
            queue = deque(directly_stale)
            while queue:
                upstream_id = queue.popleft()
                for dependent_id in dependents[upstream_id]:
                    if dependent_id not in stale_ids:
                        stale_ids.add(dependent_id)
                        queue.append(dependent_id)
            InvestigationBlock.objects.filter(id__in=stale_ids).update(stale_at=timezone.now())

        bump_investigation_version(locked)
    return locked
