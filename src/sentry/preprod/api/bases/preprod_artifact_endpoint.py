from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.request import Request

from sentry.api.bases.project import ProjectEndpoint
from sentry.preprod.models import PreprodArtifact


class HeadPreprodArtifactResourceDoesNotExist(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested head preprod artifact does not exist"


class BasePreprodArtifactResourceDoesNotExist(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested base preprod artifact does not exist"


class PreprodArtifactEndpoint(ProjectEndpoint):
    def convert_args(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)

        head_artifact_id = kwargs.get("head_artifact_id")
        if head_artifact_id is None:
            return args, kwargs

        project = kwargs.get("project")
        if project is None:
            return args, kwargs

        try:
            head_artifact = PreprodArtifact.objects.get(id=head_artifact_id)
            if head_artifact.project_id != project.id:
                raise HeadPreprodArtifactResourceDoesNotExist
        except PreprodArtifact.DoesNotExist:
            raise HeadPreprodArtifactResourceDoesNotExist

        kwargs["head_artifact"] = head_artifact

        base_artifact_id = kwargs.get("base_artifact_id")
        if base_artifact_id is None:
            return args, kwargs

        try:
            base_artifact = PreprodArtifact.objects.get(id=base_artifact_id)
            if base_artifact.project_id != project.id:
                raise BasePreprodArtifactResourceDoesNotExist
        except PreprodArtifact.DoesNotExist:
            raise BasePreprodArtifactResourceDoesNotExist

        kwargs["base_artifact"] = base_artifact
        return args, kwargs
