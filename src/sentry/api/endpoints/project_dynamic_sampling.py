from dataclasses import dataclass
from datetime import datetime

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.dynamic_sampling.rules.base import get_guarded_blended_sample_rate
from sentry.models.project import Project


class EmptyTransactionDatasetException(Exception):
    ...


@dataclass
class QueryTimeRange:
    """
    Dataclass that stores start and end time for a query.
    """

    start_time: datetime
    end_time: datetime


class DynamicSamplingReadPermission(ProjectPermission):
    scope_map = {"GET": ["project:read"]}


class DynamicSamplingPermission(ProjectPermission):
    scope_map = {"GET": ["project:write"]}


@region_silo_endpoint
class ProjectDynamicSamplingRateEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (DynamicSamplingReadPermission,)

    def get(self, request: Request, project: Project) -> Response:
        try:
            sample_rate = get_guarded_blended_sample_rate(project.organization, project)
            return Response(
                {
                    "sampleRate": sample_rate,
                },
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response(
                {"detail": "Unable to fetch project sample rate"},
                status=status.HTTP_400_BAD_REQUEST,
            )
