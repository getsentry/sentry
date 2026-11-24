from __future__ import annotations

from collections.abc import Collection
from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.creator import get_creator_reference
from sentry.apidocs.response_types import DetailResponse, ValidationErrorResponse
from sentry.auth.access import ServiceAccountAccess
from sentry.auth.principal import acting_user_id
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notebooks.access import has_notebooks_access, service_account_reaches
from sentry.notebooks.endpoints.schema import NotebookSchema
from sentry.notebooks.models import Notebook, NotebookBlock, NotebookComment
from sentry.notebooks.services import (
    NotebookConflictError,
    NotebookSourceNotFound,
    NotebookValidationError,
)
from sentry.service_accounts.auth import is_service_account_auth
from sentry.viewer_context import ActorId, actor_id_from_references


class NotebookArchivedError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Archived investigations are read-only."


def service_error(
    error: Exception,
) -> Response[ValidationErrorResponse] | Response[DetailResponse] | None:
    if isinstance(error, NotebookValidationError):
        return Response(error.errors, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(error, NotebookConflictError):
        return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
    if isinstance(error, NotebookSourceNotFound):
        raise ResourceDoesNotExist
    return None


def organization_project_ids(organization: Organization) -> set[int]:
    return set(
        Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE).values_list(
            "id", flat=True
        )
    )


def user_id(request: Request) -> int:
    resolved = acting_user_id(request.user)
    if resolved is None:
        raise PermissionDenied
    return resolved


def can_request_actor_create_notebook(request: Request) -> bool:
    return request.user.is_authenticated and not request.user.is_sentry_app


def require_authenticated_user(request: Request) -> int:
    if not can_request_actor_create_notebook(request):
        raise PermissionDenied
    return user_id(request)


def require_project_access(request: Request, project_ids: Collection[int]) -> None:
    """Keep a service account to notebooks within its projects.

    Investigation dispatch checks the same rule, so a write that passes here can always run.
    """
    if isinstance(request.access, ServiceAccountAccess) and not service_account_reaches(
        request.access, project_ids
    ):
        raise PermissionDenied


def require_notebook_writer(request: Request, notebook: Notebook | None = None) -> int | None:
    """The user behind a notebook write, or None for a service account.

    Users and agents acting for one can write; sentry apps and org auth tokens can't.
    """
    if not is_service_account_auth(request.auth):
        return require_authenticated_user(request)
    if notebook is not None:
        require_project_access(request, list(notebook.projects.values_list("id", flat=True)))
    return None


def request_creator_actor(request: Request) -> ActorId:
    """The user or service account recorded as the creator of an investigation."""
    reference = get_creator_reference(request)
    creator = actor_id_from_references(
        user_id=reference["created_by_id"],
        service_account_id=reference["created_by_service_account_id"],
    )
    if creator is None:
        raise PermissionDenied
    return creator


class NotebookPermission(OrganizationPermission):
    """
    Members of open-membership organizations can read and manage investigations
    across all projects.
    Mutations require ``org:read`` rather than the default ``org:write``.
    """

    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "PATCH": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }


class OrganizationNotebooksBaseEndpoint(OrganizationEndpoint):
    """Base for endpoints addressing the investigation collection."""

    schema = NotebookSchema()

    owner = ApiOwner.ML_AI
    permission_classes = (NotebookPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        if not has_notebooks_access(kwargs["organization"], actor=request.user):
            raise ResourceDoesNotExist
        return args, kwargs


class OrganizationNotebookEndpoint(OrganizationNotebooksBaseEndpoint):
    """Base for endpoints addressing a single investigation."""

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        notebook_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        organization = kwargs["organization"]
        try:
            notebook = Notebook.objects.select_related("organization").get(
                id=notebook_id, organization=organization
            )
        except (Notebook.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        kwargs["notebook"] = notebook
        return args, kwargs


class OrganizationNotebookBlockEndpoint(OrganizationNotebookEndpoint):
    """Base for endpoints addressing a single investigation block."""

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        notebook_id: str,
        block_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, notebook_id, *args, **kwargs
        )
        try:
            kwargs["block"] = NotebookBlock.objects.select_related("notebook").get(
                id=block_id, notebook=kwargs["notebook"]
            )
        except (NotebookBlock.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        return args, kwargs


class OrganizationNotebookCommentEndpoint(OrganizationNotebookEndpoint):
    """Base for endpoints addressing a single comment."""

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        notebook_id: str,
        comment_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, notebook_id, *args, **kwargs
        )
        try:
            kwargs["comment"] = NotebookComment.objects.get(
                id=comment_id, notebook=kwargs["notebook"]
            )
        except (NotebookComment.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        return args, kwargs
