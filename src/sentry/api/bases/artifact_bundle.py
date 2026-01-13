from __future__ import annotations

from rest_framework.exceptions import ParseError
from rest_framework.request import Request

from sentry.api.bases.project import ProjectEndpoint
from sentry.models.artifactbundle import ArtifactBundle
from sentry.models.project import Project


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
        *args,
        **kwargs,
    ):
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
            raise ParseError(
                f"The artifact bundle with {bundle_id} is not bound to this project or doesn't exist"
            )

        kwargs["artifact_bundle"] = artifact_bundle
        return args, kwargs
