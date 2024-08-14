from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.rotation_schedule_examples import RotationScheduleExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.escalation_policies.endpoints.serializers.rotation_schedule import (
    RotationSchedulePutSerializer,
    RotationScheduleSerializer,
    RotationScheduleSerializerResponse,
)
from sentry.escalation_policies.models.rotation_schedule import RotationSchedule


@extend_schema(tags=["Rotation Schedules"])
@region_silo_endpoint
class OrganizationRotationScheduleIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="List an Organization's Rotation Schedules",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListRotationSchedules", list[RotationScheduleSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=RotationScheduleExamples.LIST_ROTATION_SCHEDULES,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Return a list of Rotation Schedules bound to an organization.
        """
        queryset = RotationSchedule.objects.filter(
            organization_id=organization.id,
        )
        serializer = RotationScheduleSerializer()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=("id",),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, serializer=serializer),
        )

    @extend_schema(
        operation_id="Create or update an RotationSchedule for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=RotationSchedulePutSerializer,
        responses={
            200: RotationScheduleSerializerResponse,
            201: RotationScheduleSerializerResponse,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=RotationScheduleExamples.CREATE_OR_UPDATE_ROTATION_SCHEDULE,
    )
    def put(self, request: Request, organization) -> Response:
        """
        Create or update a rotation schedule for the given organization.
        """
        serializer = RotationSchedulePutSerializer(
            context={
                "organization": organization,
                "access": request.access,
                "user": request.user,
                "ip_address": request.META.get("REMOTE_ADDR"),
            },
            data=request.data,
        )

        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        # TODO: Check permissions -- if a rotation with passed in ID is found, rotation must be part of this org

        schedule = serializer.save()
        if "id" in request.data:
            return Response(serialize(schedule, request.user), status=status.HTTP_200_OK)
        else:
            return Response(serialize(schedule, request.user), status=status.HTTP_201_CREATED)
