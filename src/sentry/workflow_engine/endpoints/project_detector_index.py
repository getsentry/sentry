from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.issues import grouptype
from sentry.workflow_engine.models import Detector


class ProjectDetectorIndexEndpoint(ProjectEndpoint):
    # TODO: We probably need a specific permission for detectors. Possibly specific detectors have different perms
    # too?
    permission_classes = (ProjectAlertRulePermission,)

    def _get_validator(self, request, project, group_type_slug):
        detector_type = grouptype.registry.get_by_slug(group_type_slug)
        if detector_type is None:
            raise ValidationError({"groupType": ["Unknown group type"]})

        if detector_type.detector_validator is None:
            raise ValidationError({"groupType": ["Group type not compatible with detectors"]})

        return detector_type.detector_validator(
            context={
                "project": project,
                "organization": project.organization,
                "request": request,
                "access": request.access,
            },
            data=request.data,
        )

    def get(self, request, project):
        """
        List a Project's Detectors
        `````````````````````````
        Return a list of detectors for a given project.
        """
        queryset = Detector.objects.filter(
            organization_id=project.organization_id,
        ).order_by("id")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request, project):
        """
        Create a Detector
        ````````````````
        Create a new detector for a project.

        :param string name: The name of the detector
        :param string group_type: The type of detector to create
        :param object data_source: Configuration for the data source
        :param array data_conditions: List of conditions to trigger the detector
        """
        group_type = request.data.get("group_type")
        if not group_type:
            raise ValidationError({"groupType": ["This field is required."]})

        validator = self._get_validator(request, project, group_type)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        detector = validator.save()
        return Response(serialize(detector, request.user), status=status.HTTP_201_CREATED)
