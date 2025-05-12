from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import DetectorParams, GlobalParams, OrganizationParams
from sentry.db.models.query import in_icontains, in_iexact
from sentry.issues import grouptype
from sentry.models.project import Project
from sentry.search.utils import tokenize_query
from sentry.workflow_engine.endpoints.serializers import DetectorSerializer
from sentry.workflow_engine.endpoints.utils.sortby import SortByParam
from sentry.workflow_engine.models import Detector


def get_detector_validator(
    request: Request, project: Project, detector_type_slug: str, instance=None
):
    detector_type = grouptype.registry.get_by_slug(detector_type_slug)
    if detector_type is None:
        raise ValidationError({"detectorType": ["Unknown detector type"]})

    if detector_type.detector_settings is None or detector_type.detector_settings.validator is None:
        raise ValidationError({"detectorType": ["Detector type not compatible with detectors"]})

    return detector_type.detector_settings.validator(
        instance=instance,
        context={
            "project": project,
            "organization": project.organization,
            "request": request,
            "access": request.access,
        },
        data=request.data,
    )


# Maps API field name to database field name, with synthetic aggregate fields keeping
# to our field naming scheme for consistency.
SORT_ATTRS = {
    "name": "name",
    "id": "id",
    "type": "type",
    "connectedWorkflows": "connected_workflows",
}


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class OrganizationDetectorIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    # TODO: We probably need a specific permission for detectors. Possibly specific detectors have different perms
    # too?
    permission_classes = (OrganizationAlertRulePermission,)

    @extend_schema(
        operation_id="Fetch a Project's Detectors",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            DetectorParams.QUERY,
            DetectorParams.SORT,
        ],
        responses={
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request, organization):
        """
        List an Organization's Detectors
        `````````````````````````````
        Return a list of detectors for a given organization.
        """
        projects = self.get_projects(request, organization)
        queryset = Detector.objects.filter(
            project_id__in=projects,
        )

        if raw_query := request.GET.get("query"):
            tokenized_query = tokenize_query(raw_query)
            for key, values in tokenized_query.items():
                match key:
                    case "name":
                        queryset = queryset.filter(in_iexact("name", values))
                    case "type":
                        queryset = queryset.filter(in_iexact("type", values))
                    case "query":
                        queryset = queryset.filter(
                            in_icontains("description", values)
                            | in_icontains("name", values)
                            | in_icontains("type", values)
                        ).distinct()

        sort_by = SortByParam.parse(request.GET.get("sortBy", "id"), SORT_ATTRS)
        if sort_by.db_field_name == "connected_workflows":
            queryset = queryset.annotate(connected_workflows=Count("detectorworkflow"))

        queryset = queryset.order_by(*sort_by.db_order_by)

        return self.paginate(
            request=request,
            paginator_cls=OffsetPaginator,
            queryset=queryset,
            order_by=sort_by.db_order_by,
            on_results=lambda x: serialize(x, request.user),
        )
