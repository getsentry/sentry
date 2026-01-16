from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact


class PreprodArtifactResourceDoesNotExist(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested preprod artifact does not exist"


class HeadPreprodArtifactResourceDoesNotExist(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested head preprod artifact does not exist"


class BasePreprodArtifactResourceDoesNotExist(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested base preprod artifact does not exist"


class OrganizationPreprodArtifactPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        # Some simple actions, like triggering comparisons, should be allowed
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:admin"],
    }


# Keep for backwards compatibility during migration
ProjectPreprodArtifactPermission = OrganizationPreprodArtifactPermission


class PreprodArtifactEndpoint(OrganizationEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (OrganizationPreprodArtifactPermission,)

    def convert_args(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        # Pop project_id_or_slug before calling super() since OrganizationEndpoint doesn't expect it
        project_id_or_slug = kwargs.pop("project_id_or_slug", None) or kwargs.pop(
            "project_slug", None
        )

        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs.pop("organization")

        head_artifact_id = kwargs.get("head_artifact_id")
        if head_artifact_id is None:
            return args, kwargs

        try:
            head_artifact = PreprodArtifact.objects.select_related(
                "mobile_app_info", "project"
            ).get(id=int(head_artifact_id))
        except (PreprodArtifact.DoesNotExist, ValueError):
            raise HeadPreprodArtifactResourceDoesNotExist

        # Verify the artifact belongs to this organization
        if head_artifact.project.organization_id != organization.id:
            raise HeadPreprodArtifactResourceDoesNotExist

        project = head_artifact.project

        # Verify the project is active
        if project.status != ObjectStatus.ACTIVE:
            raise HeadPreprodArtifactResourceDoesNotExist

        # If project_id_or_slug is provided, validate it matches the artifact's project
        if project_id_or_slug is not None:
            try:
                requested_project = Project.objects.get(
                    organization_id=organization.id,
                    slug__id_or_slug=project_id_or_slug,
                    status=ObjectStatus.ACTIVE,
                )
            except Project.DoesNotExist:
                raise HeadPreprodArtifactResourceDoesNotExist

            if requested_project.id != project.id:
                raise HeadPreprodArtifactResourceDoesNotExist

        # Check if the user has access to the project (only for user-authenticated requests)
        # Service-to-service calls (like LaunchpadRpc) are trusted and skip this check
        if request.user.is_authenticated and not request.access.has_project_access(project):
            raise PermissionDenied

        kwargs["head_artifact"] = head_artifact
        kwargs["project"] = project

        base_artifact_id = kwargs.get("base_artifact_id")
        if base_artifact_id is None:
            return args, kwargs

        try:
            base_artifact = PreprodArtifact.objects.select_related("mobile_app_info").get(
                id=int(base_artifact_id)
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            raise BasePreprodArtifactResourceDoesNotExist

        if base_artifact.project_id != project.id:
            raise BasePreprodArtifactResourceDoesNotExist

        kwargs["base_artifact"] = base_artifact
        return args, kwargs
