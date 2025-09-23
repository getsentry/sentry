from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationDetectorPermission, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import DetectorParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Detector


class ResolveIssuesResponse(TypedDict):
    resolved_count: int


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class OrganizationDetectorResolveIssuesEndpoint(OrganizationEndpoint):
    def convert_args(self, request: Request, detector_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            detector = Detector.objects.select_related("project").get(id=detector_id)
            if detector.project.organization_id != kwargs["organization"].id:
                raise ResourceDoesNotExist
            kwargs["detector"] = detector
        except Detector.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    permission_classes = (OrganizationDetectorPermission,)

    @extend_schema(
        operation_id="Resolve All Issues for a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DetectorParams.DETECTOR_ID,
        ],
        responses={
            200: inline_sentry_response_serializer("ResolveIssuesResponse", ResolveIssuesResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization: Organization, detector: Detector):
        """
        Resolve All Issues for a Detector
        `````````````````````````````````
        Resolve all issues (groups) associated with the specified detector.
        """
        detector_groups = Group.objects.filter(detectorgroup__detector_id=detector.id)
        groups_to_resolve = [group for group in detector_groups if not group.is_resolved()]

        if groups_to_resolve:
            Group.objects.update_group_status(
                groups=groups_to_resolve,
                status=GroupStatus.RESOLVED,
                substatus=None,
                activity_type=ActivityType.SET_RESOLVED,
                activity_data={"detector_id": detector.id},
                send_activity_notification=True,
                detector_id=detector.id,
            )

        return Response(
            status=200, data=ResolveIssuesResponse(resolved_count=len(groups_to_resolve))
        )
