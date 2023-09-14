from typing import Any, Tuple

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
from sentry.models.release_threshold.releasethreshold import ReleaseThreshold


@region_silo_endpoint
class ReleaseThresholdDetailsEndpoint(ProjectEndpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self,
        request: Request,
        organization_slug: str,
        project_slug: str,
        threshold_id: str,
        *args,
        **kwargs,
    ) -> Tuple[Any, Any]:
        parsed_args, parsed_kwargs = super().convert_args(
            request, organization_slug, project_slug, *args, **kwargs
        )
        try:
            parsed_kwargs["release_threshold"] = ReleaseThreshold.objects.get(
                id=threshold_id,
                project=parsed_kwargs["project"],
            )
        except ReleaseThreshold.DoesNotExist:
            raise ResourceDoesNotExist
        return parsed_args, parsed_kwargs

    def get(
        self, request: Request, project: Project, release_threshold: ReleaseThreshold
    ) -> HttpResponse:
        return Response(serialize(release_threshold, request.user), status=200)
