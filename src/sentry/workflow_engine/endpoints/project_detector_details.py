from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import DetectorParams, GlobalParams
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.project import Project
from sentry.workflow_engine.endpoints.serializers import DetectorSerializer
from sentry.workflow_engine.models import Detector


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class ProjectDetectorDetailsEndpoint(ProjectEndpoint):
    def convert_args(self, request: Request, detector_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["detector"] = Detector.objects.get(project=kwargs["project"], id=detector_id)
        except Detector.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    # TODO: We probably need a specific permission for detectors. Possibly specific detectors have different perms
    # too?
    permission_classes = (ProjectAlertRulePermission,)

    @extend_schema(
        operation_id="Fetch a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            DetectorParams.DETECTOR_ID,
        ],
        responses={
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project, detector: Detector):
        """
        Fetch a detector
        `````````````````````````
        Return details on an individual detector.
        """
        serialized_detector = serialize(
            detector,
            request.user,
            DetectorSerializer(),
        )
        return Response(serialized_detector)

    @extend_schema(
        operation_id="Delete a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            DetectorParams.DETECTOR_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project: Project, detector: Detector):
        """
        Delete a detector
        """
        if detector.type == ErrorGroupType.slug:
            return Response(status=403)

        RegionScheduledDeletion.schedule(detector, days=0, actor=request.user)
        # TODO add audit log entry
        return Response(status=204)
