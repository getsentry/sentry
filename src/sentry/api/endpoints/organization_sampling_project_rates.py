from collections.abc import Mapping
from typing import Any

from django.db import transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project

OPTION_KEY = "sentry:target_sample_rate"


class GetSerializer(Serializer):
    """TODO"""

    def get_attrs(self, item_list, user, **kwargs) -> Mapping[Project, float]:
        return ProjectOption.objects.get_value_bulk(item_list, OPTION_KEY)

    def serialize(self, obj: Project, attrs: float, user, **kwargs) -> Mapping[str, Any]:
        return {"id": obj.id, "sampleRate": attrs}


class PutSerializer(serializers.Serializer):
    """TODO"""

    id = serializers.IntegerField(required=True)
    sampleRate = serializers.FloatField(required=True, min_value=0, max_value=1)

    def validate(self, data, **kwargs) -> Mapping[str, Any]:
        return data


@region_silo_endpoint
class OrganizationSamplingProjectRatesEndpoint(OrganizationEndpoint):
    """TODO"""

    owner = ApiOwner.TELEMETRY_EXPERIENCE

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization) -> Response:
        """TODO"""

        # NOTE: This fetches all projects in the organization. We do not filter
        # to projects the org member has access to as the sample rate and
        # project ID do not constitute sensitive information.
        queryset = Project.objects.filter(
            organization=organization,
            status=Project.ACTIVE,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, GetSerializer()),
        )

    def put(self, request: Request, organization) -> Response:
        """TODO"""

        if not isinstance(request.DATA, list):
            raise ValueError("projects must be a dictionary")

        serializer = PutSerializer(request.DATA, many=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        project_ids = [d["id"] for d in serializer.data]
        projects = self.get_projects(request, organization, project_ids=project_ids)

        rate_by_project = {d["id"]: d["sampleRate"] for d in serializer.data}
        with transaction.atomic():
            for project in projects:
                project.set_option(OPTION_KEY, rate_by_project[project.id])

        return Response(status=204)
