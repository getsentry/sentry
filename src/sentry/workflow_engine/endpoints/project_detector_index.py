import builtins

from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.models.project import Project
from sentry.workflow_engine.endpoints.serializers import DetectorSerializer
from sentry.workflow_engine.models import Detector


def get_detector_validator(
    request: Request, project: Project, detector_type_slug: builtins.type[GroupType], instance=None
):
    detector_type = grouptype.registry.get_by_slug(detector_type_slug)
    if detector_type is None:
        raise ValidationError({"detectorType": ["Unknown detector type"]})

    if detector_type.detector_validator is None:
        raise ValidationError({"detectorType": ["Detector type not compatible with detectors"]})

    return detector_type.detector_validator(
        instance=instance,
        context={
            "project": project,
            "organization": project.organization,
            "request": request,
            "access": request.access,
        },
        data=request.data,
    )


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class ProjectDetectorIndexEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    # TODO: We probably need a specific permission for detectors. Possibly specific detectors have different perms
    # too?
    permission_classes = (ProjectAlertRulePermission,)

    @extend_schema(
        operation_id="Fetch a Project's Detectors",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        responses={
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request, project):
        """
        List a Project's Detectors
        `````````````````````````
        Return a list of detectors for a given project.
        """
        queryset = Detector.objects.filter(
            project_id=project.id,
        ).order_by("id")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )

    @extend_schema(
        operation_id="Create a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=PolymorphicProxySerializer(
            "GenericDetectorSerializer",
            serializers=[
                gt.detector_validator for gt in grouptype.registry.all() if gt.detector_validator
            ],
            resource_type_field_name=None,
        ),
        responses={
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request, project):
        """
        Create a Detector
        ````````````````
        Create a new detector for a project.

        :param string name: The name of the detector
        :param string detector_type: The type of detector to create
        :param object data_source: Configuration for the data source
        :param array data_conditions: List of conditions to trigger the detector
        """
        detector_type = request.data.get("detectorType")
        if not detector_type:
            raise ValidationError({"detectorType": ["This field is required."]})

        validator = get_detector_validator(request, project, detector_type)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        detector = validator.save()
        return Response(serialize(detector, request.user), status=status.HTTP_201_CREATED)
