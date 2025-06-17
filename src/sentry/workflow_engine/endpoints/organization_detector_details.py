from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationDetectorPermission, OrganizationEndpoint
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
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues import grouptype
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.serializers import DetectorSerializer
from sentry.workflow_engine.endpoints.validators.detector_workflow import can_edit_detector
from sentry.workflow_engine.endpoints.validators.utils import get_unknown_detector_type_error
from sentry.workflow_engine.models import Detector


def get_detector_validator(
    request: Request, project: Project, detector_type_slug: str, instance=None
):
    type = grouptype.registry.get_by_slug(detector_type_slug)
    if type is None:
        error_message = get_unknown_detector_type_error(detector_type_slug, project.organization)
        raise ValidationError({"type": [error_message]})

    if type.detector_settings is None or type.detector_settings.validator is None:
        raise ValidationError({"type": ["Detector type not compatible with detectors"]})

    return type.detector_settings.validator(
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
class OrganizationDetectorDetailsEndpoint(OrganizationEndpoint):
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
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    # TODO: We probably need a specific permission for detectors. Possibly specific detectors have different perms
    # too?
    permission_classes = (OrganizationDetectorPermission,)

    @extend_schema(
        operation_id="Fetch a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
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
    def get(self, request: Request, organization: Organization, detector: Detector):
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
        operation_id="Update a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DetectorParams.DETECTOR_ID,
        ],
        request=PolymorphicProxySerializer(
            "GenericDetectorSerializer",
            serializers=[
                gt.detector_settings.validator
                for gt in grouptype.registry.all()
                if gt.detector_settings and gt.detector_settings.validator
            ],
            resource_type_field_name=None,
        ),
        responses={
            200: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, organization: Organization, detector: Detector) -> Response:
        """
        Update a Detector
        ````````````````
        Update an existing detector for a project.
        """
        if not can_edit_detector(detector, request):
            raise PermissionDenied

        group_type = request.data.get("type") or detector.group_type.slug
        validator = get_detector_validator(request, detector.project, group_type, detector)

        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_detector = validator.save()
        return Response(serialize(updated_detector, request.user), status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="Delete a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DetectorParams.DETECTOR_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization: Organization, detector: Detector):
        """
        Delete a detector
        """
        if not can_edit_detector(detector, request):
            raise PermissionDenied

        if detector.type == ErrorGroupType.slug:
            return Response(status=403)

        RegionScheduledDeletion.schedule(detector, days=0, actor=request.user)
        detector.update(status=ObjectStatus.PENDING_DELETION)
        create_audit_entry(
            request=request,
            organization=detector.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("DETECTOR_REMOVE"),
            data=detector.get_audit_log_data(),
        )
        return Response(status=204)
