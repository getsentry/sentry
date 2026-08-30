from __future__ import annotations

from collections.abc import Sequence
from collections.abc import Set as AbstractSet
from typing import Any

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecutionProject,
    InvestigationProject,
)
from sentry.investigations.services import (
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
)
from sentry.models.organization import Organization

FEATURE = "organizations:investigations"


def feature_enabled(request: Request, organization: Organization) -> bool:
    """
    Open organization membership permits summary listing. Full-detail and reuse
    endpoints also require access to every selected or execution-represented project.
    """
    return (
        features.has(FEATURE, organization, actor=request.user)
        and request.access.has_open_membership
    )


def service_error(error: Exception) -> Response | None:
    if isinstance(error, InvestigationValidationError):
        return Response(error.errors, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(error, InvestigationConflictError):
        return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
    if isinstance(error, InvestigationSourceNotFound):
        raise ResourceDoesNotExist
    return None


def investigation_ids_with_project_access(
    investigations: Sequence[Investigation], accessible_project_ids: AbstractSet[int]
) -> set[int]:
    investigation_ids = {investigation.id for investigation in investigations}
    inaccessible_ids = set(
        InvestigationProject.objects.filter(investigation_id__in=investigation_ids)
        .exclude(project_id__in=accessible_project_ids)
        .values_list("investigation_id", flat=True)
    )
    execution_investigation_ids: dict[int, int] = {}
    for (
        investigation_id,
        result_execution_id,
        content_execution_id,
    ) in InvestigationBlock.objects.filter(
        investigation_id__in=investigation_ids, deleted_at__isnull=True
    ).values_list("investigation_id", "result_execution_id", "content_execution_id"):
        if result_execution_id is not None:
            execution_investigation_ids[result_execution_id] = investigation_id
        if content_execution_id is not None:
            execution_investigation_ids[content_execution_id] = investigation_id
    inaccessible_execution_ids = InvestigationBlockExecutionProject.objects.filter(
        execution_id__in=execution_investigation_ids
    ).exclude(project_id__in=accessible_project_ids)
    inaccessible_ids.update(
        execution_investigation_ids[execution_id]
        for execution_id in inaccessible_execution_ids.values_list("execution_id", flat=True)
    )
    return investigation_ids - inaccessible_ids


def require_investigation_project_access(
    investigation: Investigation, accessible_project_ids: AbstractSet[int]
) -> None:
    if investigation.id not in investigation_ids_with_project_access(
        [investigation], accessible_project_ids
    ):
        raise PermissionDenied("You do not have access to every project in this investigation.")


def user_id(request: Request) -> int:
    resolved = request.user.id
    if resolved is None:
        raise PermissionDenied
    return resolved


def can_request_actor_create_investigation(request: Request) -> bool:
    return request.user.is_authenticated and not request.user.is_sentry_app


def require_authenticated_user(request: Request) -> int:
    if not can_request_actor_create_investigation(request):
        raise PermissionDenied
    return user_id(request)


class InvestigationPermission(OrganizationPermission):
    """
    Organization members may list investigation summaries.

    Mutations require ``org:read`` rather than the default ``org:write``; endpoints
    exposing or reusing a full investigation additionally enforce its project access.
    """

    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "PATCH": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }


class OrganizationInvestigationsBaseEndpoint(OrganizationEndpoint):
    """Base for endpoints addressing the investigation collection."""

    owner = ApiOwner.ML_AI
    permission_classes = (InvestigationPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        if not feature_enabled(request, kwargs["organization"]):
            raise ResourceDoesNotExist
        return args, kwargs


class OrganizationInvestigationEndpoint(OrganizationInvestigationsBaseEndpoint):
    """Base for endpoints addressing a single investigation."""

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        investigation_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        organization = kwargs["organization"]
        try:
            investigation = Investigation.objects.select_related("organization").get(
                id=investigation_id, organization=organization
            )
        except (Investigation.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        kwargs["investigation"] = investigation
        require_investigation_project_access(investigation, request.access.accessible_project_ids)
        return args, kwargs


class OrganizationInvestigationBlockEndpoint(OrganizationInvestigationEndpoint):
    """Base for endpoints addressing a single investigation block."""

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        investigation_id: str,
        block_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, investigation_id, *args, **kwargs
        )
        try:
            kwargs["block"] = InvestigationBlock.objects.select_related("investigation").get(
                id=block_id, investigation=kwargs["investigation"]
            )
        except (InvestigationBlock.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        return args, kwargs
