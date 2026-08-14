from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.models import Investigation, InvestigationBlock
from sentry.investigations.services import (
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
)
from sentry.models.organization import Organization
from sentry.models.project import Project

FEATURE = "organizations:investigations"


def feature_enabled(request: Request, organization: Organization) -> bool:
    """
    Investigations are organization-visible with no per-investigation access
    control, so for now they are limited to organizations with open membership.
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


class InvestigationPermission(OrganizationPermission):
    """
    Any organization member may read and edit investigations.

    There is no per-investigation access control in this pass, so mutations
    require only ``org:read`` rather than the default ``org:write``.
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
        if not required_investigation_project_ids(investigation).issubset(
            request.access.accessible_project_ids
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
