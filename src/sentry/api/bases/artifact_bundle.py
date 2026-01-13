from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.request import Request

from sentry.api.bases.project import ProjectEndpoint
from sentry.models.artifactbundle import ArtifactBundle
from sentry.models.project import Project


class ArtifactBundleError(APIException):
    """
    Custom exception that produces {"error": "..."} format for backward compatibility.

    The original endpoints returned Response({"error": "..."}, status=400), so we need
    to maintain this format to avoid breaking API clients that parse the "error" key.
    """

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str):
        # Set detail directly to produce {"error": "..."} format
        # instead of DRF's default {"detail": "..."} format
        self.detail = {"error": message}


class ProjectArtifactBundleEndpoint(ProjectEndpoint):
    """
    Base class for endpoints that operate on artifact bundles within a project.

    This class provides common functionality for resolving artifact bundles
    that are bound to a specific project.
    """

    def convert_args(
        self,
        request: Request,
        bundle_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        # Call parent to get project
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project: Project = kwargs["project"]

        # Fetch artifact bundle bound to this project
        try:
            artifact_bundle = ArtifactBundle.objects.filter(
                organization_id=project.organization.id,
                bundle_id=bundle_id,
                projectartifactbundle__project_id=project.id,
            )[0]
        except IndexError:
            raise ArtifactBundleError(
                f"The artifact bundle with {bundle_id} is not bound to this project or doesn't exist"
            )

        kwargs["artifact_bundle"] = artifact_bundle
        return args, kwargs
