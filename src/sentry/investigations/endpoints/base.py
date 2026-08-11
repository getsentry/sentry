from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.models import Investigation, InvestigationBlock, InvestigationPermissions
from sentry.investigations.permissions import InvestigationPermission, is_organization_manager
from sentry.investigations.services import (
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
)
from sentry.models.organization import Organization
from sentry.models.project import Project

FEATURE = "organizations:investigations"
QUERY_EXECUTION_FEATURE = "organizations:investigations-query-execution"


def feature_enabled(request: Request, organization: Organization) -> bool:
    return features.has(FEATURE, organization, actor=request.user)


def query_execution_enabled(request: Request, organization: Organization) -> bool:
    return features.has(QUERY_EXECUTION_FEATURE, organization, actor=request.user)


def require_breached_metric_feature(request: Request, organization: Organization) -> None:
    if not feature_enabled(request, organization) or not query_execution_enabled(
        request, organization
    ):
        raise ResourceDoesNotExist


def service_error(error: Exception) -> Response | None:
    if isinstance(error, InvestigationValidationError):
        return Response(error.errors, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(error, InvestigationConflictError):
        return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
    if isinstance(error, InvestigationSourceNotFound):
        raise ResourceDoesNotExist
    return None


def accessible_project_ids(
    endpoint: OrganizationEndpoint, request: Request, organization: Organization
) -> set[int]:
    return {project.id for project in endpoint.get_projects(request, organization)}


def required_investigation_project_ids(investigation: Investigation) -> set[int]:
    selected = set(investigation.projects.values_list("id", flat=True))
    visible_execution_ids: set[int] = set()
    for result_execution_id, content_execution_id in InvestigationBlock.objects.filter(
        investigation=investigation, deleted_at__isnull=True
    ).values_list("result_execution_id", "content_execution_id"):
        if result_execution_id is not None:
            visible_execution_ids.add(result_execution_id)
        if content_execution_id is not None:
            visible_execution_ids.add(content_execution_id)
    represented = set(
        Project.objects.filter(
            investigationblockexecutionproject__execution_id__in=visible_execution_ids,
        ).values_list("id", flat=True)
    )
    return selected | represented


def user_id(request: Request) -> int:
    resolved = request.user.id
    if resolved is None:
        raise PermissionDenied
    return resolved


def require_authenticated_user(request: Request) -> int:
    if not request.user.is_authenticated or request.user.is_sentry_app:
        raise PermissionDenied
    return user_id(request)


def ensure_permissions(investigation: Investigation) -> InvestigationPermissions:
    try:
        return investigation.permissions
    except InvestigationPermissions.DoesNotExist:
        permissions, _ = InvestigationPermissions.objects.get_or_create(investigation=investigation)
        investigation.permissions = permissions
        return permissions


def can_edit(request: Request, organization: Organization, investigation: Investigation) -> bool:
    return is_organization_manager(request, organization) or ensure_permissions(
        investigation
    ).has_edit_permissions(user_id(request))


def can_manage(request: Request, organization: Organization, investigation: Investigation) -> bool:
    return user_id(request) == investigation.created_by_id or is_organization_manager(
        request, organization
    )


def require_manager_or_creator(
    request: Request, organization: Organization, investigation: Investigation
) -> None:
    if not can_manage(request, organization, investigation):
        raise PermissionDenied


def serialize_permissions(
    investigation: Investigation,
    request: Request,
    organization: Organization,
) -> dict[str, Any]:
    permissions = ensure_permissions(investigation)
    return {
        "isEditableByEveryone": permissions.is_editable_by_everyone,
        "teamIds": [
            str(team_id)
            for team_id in sorted(permissions.teams_with_edit_access.values_list("id", flat=True))
        ],
        "canEdit": can_edit(request, organization, investigation),
        "canManage": can_manage(request, organization, investigation),
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
            investigation = Investigation.objects.select_related("organization", "permissions").get(
                id=investigation_id, organization=organization
            )
        except (Investigation.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        kwargs["investigation"] = investigation
        ensure_permissions(investigation)
        self.check_object_permissions(request, investigation)
        if not required_investigation_project_ids(investigation).issubset(
            accessible_project_ids(self, request, organization)
        ):
            raise PermissionDenied("You do not have access to every project in this investigation.")
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
