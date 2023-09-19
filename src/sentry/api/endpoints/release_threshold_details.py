from typing import Any

from django.http import HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.project import Project
from sentry.models.release_threshold.release_threshold import ReleaseThreshold


@region_silo_endpoint
class ReleaseThresholdDetailsEndpoint(ProjectEndpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self,
        request: Request,
        *args,
        **kwargs,
    ) -> Any:
        parsed_args, parsed_kwargs = super().convert_args(request, *args, **kwargs)
        try:
            parsed_kwargs["release_threshold"] = ReleaseThreshold.objects.get(
                id=kwargs["release_threshold"],
                project=parsed_kwargs["project"],
            )
        except ReleaseThreshold.DoesNotExist:
            raise ResourceDoesNotExist
        return parsed_args, parsed_kwargs

    def get(
        self, request: Request, project: Project, release_threshold: ReleaseThreshold
    ) -> HttpResponse:
        return Response(serialize(release_threshold, request.user), status=200)
