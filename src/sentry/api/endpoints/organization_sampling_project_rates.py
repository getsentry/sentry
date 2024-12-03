from collections.abc import Mapping, MutableMapping
from typing import Any

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.constants import TARGET_SAMPLE_RATE_DEFAULT, ObjectStatus
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project

OPTION_KEY = "sentry:target_sample_rate"


class GetSerializer(Serializer):
    """Serializer for OrganizationSamplingProjectRatesEndpoint.get"""

    def get_attrs(self, item_list, user, **kwargs) -> MutableMapping[Any, Any]:
        options = ProjectOption.objects.get_value_bulk(item_list, OPTION_KEY)
        # NOTE: `get_value_bulk` does not resolve defaults. The default does not
        # depend on epochs, so we can speed this up by using the constant.
        return {
            item: value if value is not None else TARGET_SAMPLE_RATE_DEFAULT
            for item, value in options.items()
        }

    def serialize(self, obj: Any, attrs: Any, user, **kwargs) -> Mapping[str, Any]:
        return {"id": obj.id, "sampleRate": attrs}


class PutSerializer(serializers.Serializer):
    """Serializer for OrganizationSamplingProjectRatesEndpoint.put"""

    id = serializers.IntegerField(required=True)
    sampleRate = serializers.FloatField(required=True, min_value=0, max_value=1)


@region_silo_endpoint
class OrganizationSamplingProjectRatesEndpoint(OrganizationEndpoint):
    """Bulk endpoint for managing project sampling rates."""

    owner = ApiOwner.TELEMETRY_EXPERIENCE

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (OrganizationPermission,)

    def _check_feature(self, request: Request, organization: Organization):
        if not features.has(
            "organizations:dynamic-sampling-custom", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List Sampling Rates for Projects
        ````````````````````````````````

        Return a list of sampling rates for projects in the organization by
        project ID.

        :pparam string organization_id_or_slug: the id or slug of the
            organization.
        :auth: required
        """

        self._check_feature(request, organization)

        # NOTE: This fetches all projects in the organization. We do not filter
        # to projects the org member has access to as the sample rate and
        # project ID do not constitute sensitive information.
        queryset = Project.objects.filter(
            organization=organization,
            status=ObjectStatus.ACTIVE,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, GetSerializer()),
        )

    def put(self, request: Request, organization: Organization) -> Response:
        """
        Update Sampling Rates of Projects
        `````````````````````````````````

        Bulk update the sample rate of projects in a single request.

        :pparam string organization_id_or_slug: the id or slug of the
            organization.
        :auth: required
        """

        self._check_feature(request, organization)

        if organization.get_option("sentry:sampling_mode") != DynamicSamplingMode.PROJECT:
            return Response(
                {"detail": "Sample rates for projects cannot be changed in Automatic Mode"},
                status=403,
            )

        serializer = PutSerializer(data=request.data, many=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        project_ids = {int(d["id"]) for d in serializer.data}
        projects = self.get_projects(request, organization, project_ids=project_ids)

        rate_by_project = {d["id"]: round(d["sampleRate"], 4) for d in serializer.data}
        with transaction.atomic(router.db_for_write(ProjectOption)):
            for project in projects:
                project.update_option(OPTION_KEY, rate_by_project[project.id])

        return Response(serialize(projects, request.user, GetSerializer()), status=200)
