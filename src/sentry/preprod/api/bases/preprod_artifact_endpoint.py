from __future__ import annotations

from typing import Any

import sentry_sdk
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission
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


# This is not a general permission. It specifically for triggering comparisons.
class ProjectPreprodArtifactPermission(OrganizationEventPermission):
    scope_map = {
        "GET": ["event:read", "event:write", "event:admin"],
        # Some simple actions, like triggering comparisons, should be allowed
        "POST": ["event:read", "event:write", "event:admin"],
        "PUT": ["event:read", "event:write", "event:admin"],
        "DELETE": ["event:admin"],
    }


class PreprodArtifactEndpoint(OrganizationEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (OrganizationEventPermission,)

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
                "mobile_app_info", "build_configuration", "project",
            ).get(id=int(head_artifact_id))
        except (PreprodArtifact.DoesNotExist, ValueError):
            raise HeadPreprodArtifactResourceDoesNotExist

        if head_artifact.project.organization_id != organization.id:
            raise HeadPreprodArtifactResourceDoesNotExist

        project = head_artifact.project

        if project.status != ObjectStatus.ACTIVE:
            raise HeadPreprodArtifactResourceDoesNotExist

        if project not in self.get_projects(request, organization):
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

        kwargs["head_artifact"] = head_artifact
        kwargs["project"] = project
        sentry_sdk.get_isolation_scope().set_tag("project", project.id)

        base_artifact_id = kwargs.get("base_artifact_id")
        if base_artifact_id is None:
            return args, kwargs

        try:
            base_artifact = PreprodArtifact.objects.select_related(
                "mobile_app_info", "build_configuration", "project",
            ).get(id=int(base_artifact_id))
        except (PreprodArtifact.DoesNotExist, ValueError):
            raise BasePreprodArtifactResourceDoesNotExist

        if base_artifact.project_id != project.id:
            raise BasePreprodArtifactResourceDoesNotExist

        kwargs["base_artifact"] = base_artifact
        return args, kwargs
