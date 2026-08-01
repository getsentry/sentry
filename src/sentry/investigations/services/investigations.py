from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Iterable
from copy import deepcopy
from typing import Any

from django.db import router, transaction
from django.db.models import Max
from django.utils import timezone

from sentry.investigations.models import (
    Investigation,
    InvestigationCell,
    InvestigationCellDependency,
    InvestigationCellParameter,
    InvestigationParameter,
    InvestigationParameterSource,
    InvestigationPermissions,
    InvestigationPermissionsTeam,
    InvestigationProject,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services.parameters import (
    ParameterValidationError,
    validate_parameter_value,
    validate_template_parameters,
)
from sentry.investigations.templates import InvestigationTemplateSpec, get_investigation_template
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.models.organization import Organization


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
    cell_keys = {cell.key for cell in template.cells}
    if len(cell_keys) != len(template.cells):
        raise InvestigationValidationError({"templateKey": "Template contains duplicate cells."})

    parameter_keys = {parameter.key for parameter in template.parameters}
    incoming: dict[str, int] = {key: 0 for key in cell_keys}
    dependents: dict[str, list[str]] = defaultdict(list)
    for cell in template.cells:
        unknown_dependencies = sorted(set(cell.dependencies) - cell_keys)
        if unknown_dependencies:
            raise InvestigationValidationError(
                {"templateKey": f"Cell {cell.key} has unknown dependencies."}
            )
        unknown_parameters = sorted(set(cell.parameters) - parameter_keys)
        if unknown_parameters:
            raise InvestigationValidationError(
                {"templateKey": f"Cell {cell.key} has unknown parameters."}
            )
        if cell.key in cell.dependencies:
            raise InvestigationValidationError(
                {"templateKey": f"Cell {cell.key} cannot depend on itself."}
            )
        incoming[cell.key] = len(cell.dependencies)
        for dependency in cell.dependencies:
            dependents[dependency].append(cell.key)

    queue = deque(key for key, count in incoming.items() if count == 0)
    visited = 0
    while queue:
        key = queue.popleft()
        visited += 1
        for dependent in dependents[key]:
            incoming[dependent] -= 1
            if incoming[dependent] == 0:
                queue.append(dependent)
    if visited != len(cell_keys):
        raise InvestigationValidationError(
            {"templateKey": "Template dependencies contain a cycle."}
        )


def _create_project_links(investigation: Investigation, project_ids: Iterable[int]) -> None:
    InvestigationProject.objects.bulk_create(
        [
            InvestigationProject(investigation=investigation, project_id=project_id)
            for project_id in sorted(set(project_ids))
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
        InvestigationPermissions.objects.create(investigation=investigation)
        _create_project_links(investigation, project_ids)
    return investigation


def duplicate_investigation(*, investigation: Investigation, user_id: int) -> Investigation:
    """Copy notebook structure without executions, comments, or collaboration state."""

    with transaction.atomic(using=router.db_for_write(Investigation)):
        source = Investigation.objects.select_for_update().get(id=investigation.id)
        duplicate = Investigation.objects.create(
            organization=source.organization,
            created_by_id=user_id,
            title=f"Copy of {source.title}",
            template_key=source.template_key,
            template_version=source.template_version,
            source_type=source.source_type,
            source_ref=deepcopy(source.source_ref),
            filters=deepcopy(source.filters),
        )
        InvestigationPermissions.objects.create(investigation=duplicate)
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
                constraints=deepcopy(parameter.constraints),
                default_value=deepcopy(parameter.default_value),
                saved_value=deepcopy(parameter.saved_value),
                source=parameter.source,
                position=parameter.position,
            )
            parameters_by_id[parameter.id] = copied_parameter

        cells_by_id: dict[int, InvestigationCell] = {}
        source_cells = list(source.cells.filter(deleted_at__isnull=True).order_by("position", "id"))
        for cell in source_cells:
            copied_cell = InvestigationCell.objects.create(
                investigation=duplicate,
                created_by_id=user_id,
                last_edited_by_id=user_id,
                position=cell.position,
                kind=cell.kind,
                title=cell.title,
                content=cell.content,
                prompt=cell.prompt,
                generated_content=cell.generated_content,
                config=deepcopy(cell.config),
                display=deepcopy(cell.display),
            )
            cells_by_id[cell.id] = copied_cell

        InvestigationCellParameter.objects.bulk_create(
            [
                InvestigationCellParameter(
                    cell=cells_by_id[link.cell_id],
                    parameter=parameters_by_id[link.parameter_id],
                )
                for link in InvestigationCellParameter.objects.filter(cell_id__in=cells_by_id)
            ]
        )
        InvestigationCellDependency.objects.bulk_create(
            [
                InvestigationCellDependency(
                    cell=cells_by_id[link.cell_id],
                    depends_on=cells_by_id[link.depends_on_id],
                )
                for link in InvestigationCellDependency.objects.filter(
                    cell_id__in=cells_by_id,
                    depends_on_id__in=cells_by_id,
                )
            ]
        )

    return duplicate


def _resolve_breached_metric_source(
    *, organization: Organization, source_ref: dict[str, Any], accessible_project_ids: set[int]
) -> Group:
    if set(source_ref) != {"groupId"}:
        raise InvestigationValidationError(
            {"sourceRef": "Must contain exactly groupId for breached_metric."}
        )
    group_id = source_ref["groupId"]
    if isinstance(group_id, bool) or not isinstance(group_id, int | str):
        raise InvestigationValidationError({"sourceRef": {"groupId": "Must be an issue ID."}})
    try:
        group = Group.objects.get(id=int(group_id), project__organization=organization)
    except (Group.DoesNotExist, TypeError, ValueError):
        raise InvestigationSourceNotFound
    if group.project_id not in accessible_project_ids:
        raise InvestigationSourceNotFound
    if group.issue_category != GroupCategory.METRIC:
        raise InvestigationValidationError(
            {"sourceRef": {"groupId": "Issue must be a breached metric."}}
        )
    return group


def create_template_investigation(
    *,
    organization: Organization,
    user_id: int,
    template_key: str,
    template_version: int,
    source_ref: dict[str, Any],
    supplied_parameters: dict[str, Any],
    accessible_project_ids: set[int],
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
        group = _resolve_breached_metric_source(
            organization=organization,
            source_ref=source_ref,
            accessible_project_ids=accessible_project_ids,
        )
        project_ids = [group.project_id]
        render_context = {"group_title": group.title}
        resolved_title = title or f"Investigate {group.title}"
        normalized_source_ref = {"groupId": str(group.id)}
    else:
        raise InvestigationValidationError({"templateKey": "Unsupported template source."})

    with transaction.atomic(using=router.db_for_write(Investigation)):
        investigation = Investigation.objects.create(
            organization=organization,
            created_by_id=user_id,
            title=resolved_title,
            template_key=template.key,
            template_version=template.version,
            source_type=template.source_type,
            source_ref=normalized_source_ref,
        )
        InvestigationPermissions.objects.create(investigation=investigation)
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
                constraints=deepcopy(parameter_spec.constraints),
                default_value=deepcopy(parameter_spec.default_value),
                saved_value=deepcopy(resolved_parameters[parameter_spec.key]),
                source=InvestigationParameterSource.TEMPLATE,
                position=position,
            )
            parameters_by_key[parameter.key] = parameter

        cells_by_key: dict[str, InvestigationCell] = {}
        for position, cell_spec in enumerate(template.cells):
            cell = InvestigationCell.objects.create(
                investigation=investigation,
                created_by_id=user_id,
                last_edited_by_id=user_id,
                position=position,
                kind=cell_spec.kind,
                title=cell_spec.title,
                content=cell_spec.content.format(**render_context),
                prompt=cell_spec.generation_prompt.format(**render_context),
                generated_content=cell_spec.generated_content.format(**render_context),
                config=deepcopy(cell_spec.config),
                display=deepcopy(cell_spec.display),
            )
            cells_by_key[cell_spec.key] = cell
            InvestigationCellParameter.objects.bulk_create(
                [
                    InvestigationCellParameter(
                        cell=cell, parameter=parameters_by_key[parameter_key]
                    )
                    for parameter_key in cell_spec.parameters
                ]
            )

        InvestigationCellDependency.objects.bulk_create(
            [
                InvestigationCellDependency(
                    cell=cells_by_key[cell_spec.key],
                    depends_on=cells_by_key[dependency_key],
                )
                for cell_spec in template.cells
                for dependency_key in cell_spec.dependencies
            ]
        )

    return investigation


def lock_investigation(investigation: Investigation, expected_version: int) -> Investigation:
    locked = Investigation.objects.select_for_update().get(id=investigation.id)
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
        locked.status = InvestigationStatus.ARCHIVED
        bump_investigation_version(locked)
    return locked


def create_cell(
    *,
    investigation: Investigation,
    expected_investigation_version: int,
    user_id: int,
    values: dict[str, Any],
) -> InvestigationCell:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        locked = lock_investigation(investigation, expected_investigation_version)
        if locked.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        maximum = InvestigationCell.objects.filter(
            investigation=locked, deleted_at__isnull=True
        ).aggregate(maximum=Max("position"))["maximum"]
        position = 0 if maximum is None else maximum + 1
        cell = InvestigationCell.objects.create(
            investigation=locked,
            created_by_id=user_id,
            last_edited_by_id=user_id,
            position=position,
            **values,
        )
        bump_investigation_version(locked)
    return cell


def update_cell(
    *,
    cell: InvestigationCell,
    expected_investigation_version: int,
    expected_cell_version: int,
    user_id: int,
    values: dict[str, Any],
) -> InvestigationCell:
    with transaction.atomic(using=router.db_for_write(InvestigationCell)):
        investigation = lock_investigation(cell.investigation, expected_investigation_version)
        locked = InvestigationCell.objects.select_for_update().get(id=cell.id)
        if investigation.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        if locked.version != expected_cell_version:
            raise InvestigationConflictError("Cell has changed.")
        stale_fields = {"content", "prompt", "config"}
        if stale_fields.intersection(values):
            locked.stale_at = timezone.now()
        for field, value in values.items():
            setattr(locked, field, value)
        locked.last_edited_by_id = user_id
        locked.version += 1
        locked.save()
        bump_investigation_version(investigation)
    return locked


def delete_cell(
    *, cell: InvestigationCell, expected_investigation_version: int, expected_cell_version: int
) -> None:
    with transaction.atomic(using=router.db_for_write(InvestigationCell)):
        investigation = lock_investigation(cell.investigation, expected_investigation_version)
        locked = InvestigationCell.objects.select_for_update().get(id=cell.id)
        if investigation.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        if locked.version != expected_cell_version:
            raise InvestigationConflictError("Cell has changed.")
        locked.deleted_at = timezone.now()
        locked.version += 1
        locked.save(update_fields=["deleted_at", "version", "date_updated"])
        active_cells = list(
            InvestigationCell.objects.select_for_update()
            .filter(investigation=investigation, deleted_at__isnull=True)
            .order_by("position", "id")
        )
        for position, active_cell in enumerate(active_cells):
            active_cell.position = position
        InvestigationCell.objects.bulk_update(active_cells, ["position"])
        bump_investigation_version(investigation)


def reorder_cells(
    *, investigation: Investigation, expected_version: int, cell_uuids: list[str]
) -> Investigation:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        locked = lock_investigation(investigation, expected_version)
        if locked.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        cells = list(
            InvestigationCell.objects.select_for_update().filter(
                investigation=locked, deleted_at__isnull=True
            )
        )
        existing = {str(cell.uuid): cell for cell in cells}
        if len(cell_uuids) != len(set(cell_uuids)):
            raise InvestigationValidationError({"cellIds": "Cell IDs must be unique."})
        if set(cell_uuids) != set(existing):
            raise InvestigationValidationError(
                {"cellIds": "Must contain every active cell exactly once."}
            )
        ordered = [existing[cell_uuid] for cell_uuid in cell_uuids]
        for position, cell in enumerate(ordered):
            cell.position = position
        InvestigationCell.objects.bulk_update(ordered, ["position"])
        bump_investigation_version(locked)
    return locked


def update_parameter_values(
    *,
    investigation: Investigation,
    expected_version: int,
    values: dict[str, Any],
    accessible_project_ids: set[int],
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
            try:
                validated = validate_parameter_value(
                    parameter_type=parameter.type,
                    value=value,
                    constraints=parameter.constraints,
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
                InvestigationCellParameter.objects.filter(
                    parameter_id__in=changed_parameter_ids,
                    cell__investigation=locked,
                    cell__deleted_at__isnull=True,
                ).values_list("cell_id", flat=True)
            )
            dependent_edges = InvestigationCellDependency.objects.filter(
                cell__investigation=locked,
                cell__deleted_at__isnull=True,
                depends_on__deleted_at__isnull=True,
            ).values_list("depends_on_id", "cell_id")
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
            InvestigationCell.objects.filter(id__in=stale_ids).update(stale_at=timezone.now())

        bump_investigation_version(locked)
    return locked


def update_permissions(
    *,
    investigation: Investigation,
    expected_version: int,
    editable_by_everyone: bool,
    team_ids: list[int],
) -> InvestigationPermissions:
    with transaction.atomic(using=router.db_for_write(Investigation)):
        locked_investigation = lock_investigation(investigation, expected_version)
        if locked_investigation.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        permissions, _ = InvestigationPermissions.objects.select_for_update().get_or_create(
            investigation=locked_investigation
        )
        permissions.is_editable_by_everyone = editable_by_everyone
        permissions.save(update_fields=["is_editable_by_everyone"])
        InvestigationPermissionsTeam.objects.filter(permissions=permissions).delete()
        InvestigationPermissionsTeam.objects.bulk_create(
            [
                InvestigationPermissionsTeam(permissions=permissions, team_id=team_id)
                for team_id in sorted(set(team_ids))
            ]
        )
        bump_investigation_version(locked_investigation)
    return permissions
