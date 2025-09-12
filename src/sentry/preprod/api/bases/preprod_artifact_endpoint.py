from typing import Any

from rest_framework.request import Request

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.preprod.models import PreprodArtifact


class PreprodArtifactEndpoint(ProjectEndpoint):
    def convert_args(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)

        artifact_id = kwargs.get("artifact_id")
        if artifact_id is None:
            return args, kwargs

        project = kwargs.get("project")
        if project is None:
            return args, kwargs

        try:
            artifact = PreprodArtifact.objects.get(id=artifact_id)
            if artifact.project_id != project.id:
                raise ResourceDoesNotExist
        except PreprodArtifact.DoesNotExist:
            raise ResourceDoesNotExist

        kwargs["artifact"] = artifact
        return args, kwargs
