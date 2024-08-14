from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.rotation_schedule_examples import RotationScheduleExamples
from sentry.apidocs.parameters import GlobalParams, RotationScheduleParams
from sentry.escalation_policies.endpoints.serializers.rotation_schedule import (
    RotationScheduleSerializer,
    RotationScheduleSerializerResponse,
)
from sentry.escalation_policies.models.rotation_schedule import RotationSchedule


@extend_schema(tags=["Rotation Schedules"])
@region_silo_endpoint
class OrganizationRotationScheduleDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationPermission,)

    def convert_args(self, request: Request, rotation_schedule_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]

        try:
            kwargs["rotation_schedule"] = RotationSchedule.objects.get(
                organization=organization, id=rotation_schedule_id
            )
        except RotationSchedule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    @extend_schema(
        operation_id="Get an Rotation Schedule",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, RotationScheduleParams.ROTATION_SCHEDULE_ID],
        request=None,
        responses={
            200: RotationScheduleSerializerResponse,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=RotationScheduleExamples.GET_ROTATION_SCHEDULE,
    )
    def get(self, request: Request, organization, rotation_schedule) -> Response:
        """
        Return a single Rotation Schedule
        """
        rotation_schedule = RotationSchedule.objects.get(
            organization_id=organization.id,
        )
        serializer = RotationScheduleSerializer()

        return Response(serialize(rotation_schedule, serializer))

    @extend_schema(
        operation_id="Delete an Rotation Schedule for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, RotationScheduleParams.ROTATION_SCHEDULE_ID],
        request=None,
        responses={
            204: None,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,
    )
    def delete(self, request: Request, organization, rotation_schedule) -> Response:
        """
        Create or update an Rotation Schedule for the given organization.
        """
        rotation_schedule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
