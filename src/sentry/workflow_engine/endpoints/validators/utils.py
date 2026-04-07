import logging
from collections.abc import Sequence
from typing import Any, Literal

from django.db import router, transaction
from django.db.models import QuerySet
from django.forms import ValidationError
from jsonschema import ValidationError as JsonValidationError
from jsonschema import validate
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import audit_log
from sentry.issues import grouptype
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.types.actor import Actor
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.models.workflow import Workflow

logger = logging.getLogger(__name__)

# Only those with organization write permissions can edit system-created detectors (e.g. error detectors).
SYSTEM_CREATED_DETECTOR_REQUIRED_SCOPES = {"org:write"}
USER_CREATED_DETECTOR_REQUIRED_SCOPES = {"org:write", "alerts:write"}


def is_system_created_detector(detector: Detector) -> bool:
    # Lazy imports to avoid circular imports: grouptype imports from validators/base
    # which imports from this module.
    from sentry.grouping.grouptype import ErrorGroupType
    from sentry.issue_detection.performance_detection import PERFORMANCE_WFE_DETECTOR_TYPES
    from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

    return (
        detector.type in (ErrorGroupType.slug, IssueStreamGroupType.slug)
        or detector.type in PERFORMANCE_WFE_DETECTOR_TYPES
    )


def can_edit_system_created_detectors(request: Request, project: Project) -> bool:
    return request.access.has_any_project_scope(project, SYSTEM_CREATED_DETECTOR_REQUIRED_SCOPES)


def can_edit_user_created_detectors(request: Request, project: Project) -> bool:
    return request.access.has_any_project_scope(project, USER_CREATED_DETECTOR_REQUIRED_SCOPES)


def can_edit_detectors(detectors: QuerySet[Detector], request: Request) -> bool:
    """
    Determine if the requesting user has access to edit the given detectors.
    System created detectors lock edit access to org:write, while user created detectors
    are more permissive.
    """
    required_scopes = (
        SYSTEM_CREATED_DETECTOR_REQUIRED_SCOPES
        if any(is_system_created_detector(detector) for detector in detectors)
        else USER_CREATED_DETECTOR_REQUIRED_SCOPES
    )

    projects = Project.objects.filter(
        id__in=detectors.values_list("project_id", flat=True).distinct()
    )

    return all(
        request.access.has_any_project_scope(project, required_scopes) for project in projects
    )


def can_edit_detector(detector: Detector, request: Request) -> bool:
    """
    Determine if the requesting user has access to detector edit. If the request does not have the "alerts:write"
    permission, then we must verify that the user is a team admin with "alerts:write" access to the project(s)
    in their request.
    """
    if is_system_created_detector(detector) and not can_edit_system_created_detectors(
        request, detector.project
    ):
        return False

    return can_edit_user_created_detectors(request, detector.project)


def can_delete_detectors(detectors: QuerySet[Detector], request: Request) -> bool:
    """
    Determine if the requesting user has access to delete the given detectors.
    Only user-created detectors can be deleted, and require "alerts:write" permission.
    """
    if any(is_system_created_detector(detector) for detector in detectors):
        return False

    projects = Project.objects.filter(
        id__in=detectors.values_list("project_id", flat=True).distinct()
    )
    return all(can_edit_user_created_detectors(request, project) for project in projects)


def can_delete_detector(detector: Detector, request: Request) -> bool:
    """
    Determine if the requesting user has access to delete the given detector.
    Only user-created detectors can be deleted, and require "alerts:write" permission.
    """
    if is_system_created_detector(detector):
        return False

    return can_edit_user_created_detectors(request, detector.project)


def can_edit_detector_workflow_connections(detector: Detector, request: Request) -> bool:
    """
    Anyone with alert write access to the project can connect/disconnect detectors of any type,
    which is slightly different from full edit access which differs by detector type.
    """
    return request.access.has_any_project_scope(
        detector.project, USER_CREATED_DETECTOR_REQUIRED_SCOPES
    )


def validate_detectors_exist_and_have_permissions(
    detector_ids: list[int], organization: Organization, request: Request
) -> QuerySet[Detector]:
    detectors = Detector.objects.filter(
        project__organization=organization,
        id__in=detector_ids,
    )
    found_detector_ids = set(detectors.values_list("id", flat=True))
    missing_detector_ids = set(detector_ids) - found_detector_ids

    if missing_detector_ids:
        raise serializers.ValidationError(f"Some detectors do not exist: {missing_detector_ids}")

    if not all(can_edit_detector_workflow_connections(detector, request) for detector in detectors):
        raise PermissionDenied

    return detectors


def validate_workflows_exist(
    workflow_ids: list[int], organization: Organization
) -> QuerySet[Workflow]:
    workflows = Workflow.objects.filter(organization=organization, id__in=workflow_ids)
    found_workflow_ids = set(workflows.values_list("id", flat=True))
    missing_workflow_ids = set(workflow_ids) - found_workflow_ids

    if missing_workflow_ids:
        raise serializers.ValidationError(f"Some workflows do not exist: {missing_workflow_ids}")

    return workflows


def connect_workflows_to_detectors(
    request: Request,
    organization: Organization,
    workflow_id: int,
    detector_ids: list[int] | None,
    update: bool = False,
) -> None:
    if detector_ids is not None:
        validate_detectors_exist_and_have_permissions(detector_ids, organization, request)

        def get_detector_workflows_to_add(
            workflow_id: int, detector_ids: set[int]
        ) -> list[dict[Literal["detector_id", "workflow_id"], int]]:
            detector_workflows_to_add: list[dict[Literal["detector_id", "workflow_id"], int]] = [
                {"detector_id": detector_id, "workflow_id": workflow_id}
                for detector_id in detector_ids
            ]
            return detector_workflows_to_add

        if update:
            existing_detector_workflows = list(
                DetectorWorkflow.objects.filter(
                    workflow_id=workflow_id,
                )
            )
            new_detector_ids = set(detector_ids) - {
                dw.detector_id for dw in existing_detector_workflows
            }

            detector_workflows_to_add = get_detector_workflows_to_add(workflow_id, new_detector_ids)
            detector_workflows_to_remove = [
                dw for dw in existing_detector_workflows if dw.detector_id not in detector_ids
            ]
        else:
            detector_workflows_to_add = get_detector_workflows_to_add(
                workflow_id, set(detector_ids)
            )
            detector_workflows_to_remove = []

        perform_bulk_detector_workflow_operations(
            detector_workflows_to_add=detector_workflows_to_add,
            detector_workflows_to_remove=detector_workflows_to_remove,
            request=request,
            organization=organization,
        )


def connect_detectors_to_workflows(
    request: Request,
    organization: Organization,
    detector_id: int,
    workflow_ids: list[int] | None,
    update: bool = False,
) -> None:
    if workflow_ids is not None:
        validate_workflows_exist(workflow_ids, organization)

        def get_detector_workflows_to_add(
            detector_id: int, workflow_ids: set[int]
        ) -> list[dict[Literal["detector_id", "workflow_id"], int]]:
            detector_workflows_to_add: list[dict[Literal["detector_id", "workflow_id"], int]] = [
                {"detector_id": detector_id, "workflow_id": workflow_id}
                for workflow_id in workflow_ids
            ]
            return detector_workflows_to_add

        if update:
            existing_detector_workflows = list(
                DetectorWorkflow.objects.filter(
                    detector_id=detector_id,
                )
            )
            new_workflow_ids = set(workflow_ids) - {
                dw.workflow_id for dw in existing_detector_workflows
            }

            detector_workflows_to_add = get_detector_workflows_to_add(detector_id, new_workflow_ids)
            detector_workflows_to_remove = [
                dw for dw in existing_detector_workflows if dw.workflow_id not in workflow_ids
            ]
        else:
            detector_workflows_to_add = get_detector_workflows_to_add(
                detector_id, set(workflow_ids)
            )
            detector_workflows_to_remove = []

        perform_bulk_detector_workflow_operations(
            detector_workflows_to_add=detector_workflows_to_add,
            detector_workflows_to_remove=detector_workflows_to_remove,
            request=request,
            organization=organization,
        )


def perform_bulk_detector_workflow_operations(
    detector_workflows_to_add: list[dict[Literal["detector_id", "workflow_id"], int]],
    detector_workflows_to_remove: Sequence[DetectorWorkflow],
    request: Request,
    organization: Organization,
) -> list[DetectorWorkflow]:
    created_detector_workflows: list[DetectorWorkflow] = []

    with transaction.atomic(router.db_for_write(DetectorWorkflow)):
        if detector_workflows_to_remove:
            DetectorWorkflow.objects.filter(
                id__in=[detector_workflow.id for detector_workflow in detector_workflows_to_remove]
            ).delete()

        if detector_workflows_to_add:
            created_detector_workflows = DetectorWorkflow.objects.bulk_create(
                [
                    DetectorWorkflow(
                        detector_id=pair["detector_id"], workflow_id=pair["workflow_id"]
                    )
                    for pair in detector_workflows_to_add
                ]
            )

    for detector_workflow in detector_workflows_to_remove:
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=detector_workflow.id,
            event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
            data=detector_workflow.get_audit_log_data(),
        )

    for detector_workflow in created_detector_workflows:
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=detector_workflow.id,
            event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
            data=detector_workflow.get_audit_log_data(),
        )

    return created_detector_workflows


def update_owner(owner: Actor | None) -> tuple[int | None, int | None]:
    if owner:
        if owner.is_user:
            owner_user_id = owner.id
            owner_team_id = None
        elif owner.is_team:
            owner_user_id = None
            owner_team_id = owner.id
    else:
        # Clear owner if None is passed
        owner_user_id = None
        owner_team_id = None

    return owner_user_id, owner_team_id


def log_alerting_quota_hit(
    object_type: str, organization: Organization, actor: User | RpcUser | None
) -> None:
    """Call when a create request is rejected because an org has reached its quota for object_type."""
    logger.info(
        "workflow_engine.quota.limit_hit",
        extra={
            "object_type": object_type,
            "organization_id": organization.id,
            "organization_slug": organization.slug,
            "actor_id": actor.id if actor is not None else None,
        },
    )
    metrics.incr("workflow_engine.quota.limit_hit", tags={"object_type": object_type})


def toggle_detector(detector: Detector, enabled: bool) -> None:
    detector.toggle(enabled)


def validate_json_schema(value: Any, schema: Any) -> Any:
    try:
        validate(value, schema)
    except JsonValidationError as e:
        raise ValidationError(str(e))

    return value


def validate_json_primitive(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        raise ValidationError(
            f"Invalid json primitive value: {value}. Must be a string, number, or boolean."
        )

    return value


def remove_items_by_api_input(
    input_data: list[dict[str, Any]], instance: Any, values_list_field: str
) -> None:
    data_ids = {int(item["id"]) for item in input_data if item.get("id") is not None}
    stored_ids = set(instance.values_list(values_list_field, flat=True))
    has_items_removed = data_ids != stored_ids

    if has_items_removed:
        filter_kwargs = {f"{values_list_field}__in": data_ids}
        instance.exclude(**filter_kwargs).delete()


def get_unknown_detector_type_error(bad_value: str, organization: Organization) -> str:
    available_types = [
        gt.slug
        for gt in grouptype.registry.get_visible(organization)
        if gt.detector_settings is not None and gt.detector_settings.validator is not None
    ]
    available_types.sort()

    if available_types:
        available_str = ", ".join(available_types)
        return f"Unknown detector type '{bad_value}'. Must be one of: {available_str}"
    else:
        return f"Unknown detector type '{bad_value}'. No detector types are available."
