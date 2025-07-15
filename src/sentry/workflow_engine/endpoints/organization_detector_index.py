from functools import partial

from django.db.models import Count, Q
from django.db.models.query import QuerySet
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.api.event_search import SearchConfig, SearchFilter, SearchKey, default_config
from sentry.api.event_search import parse_search_query as base_parse_search_query
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import DetectorParams, GlobalParams, OrganizationParams
from sentry.incidents.grouptype import MetricIssue
from sentry.issues import grouptype
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.workflow_engine.endpoints.serializers import DetectorSerializer
from sentry.workflow_engine.endpoints.utils.filters import apply_filter
from sentry.workflow_engine.endpoints.utils.sortby import SortByParam
from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
from sentry.workflow_engine.endpoints.validators.detector_workflow import DetectorWorkflowValidator
from sentry.workflow_engine.endpoints.validators.utils import get_unknown_detector_type_error
from sentry.workflow_engine.models import Detector

detector_search_config = SearchConfig.create_from(
    default_config,
    text_operator_keys={"name", "type"},
    allowed_keys={"name", "type"},
    allow_boolean=False,
    free_text_key="query",
)
parse_detector_query = partial(base_parse_search_query, config=detector_search_config)

# Maps API field name to database field name, with synthetic aggregate fields keeping
# to our field naming scheme for consistency.
SORT_ATTRS = {
    "name": "name",
    "id": "id",
    "type": "type",
    "connectedWorkflows": "connected_workflows",
}


def get_detector_validator(
    request: Request, project: Project, detector_type_slug: str, instance=None
) -> BaseDetectorTypeValidator:
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
            DetectorParams.ID,
        ],
        responses={
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        List an Organization's Detectors
        `````````````````````````````
        Return a list of detectors for a given organization.
        """
        projects = self.get_projects(request, organization)
        queryset: QuerySet[Detector] = Detector.objects.filter(
            project_id__in=projects,
        )

        if raw_idlist := request.GET.getlist("id"):
            try:
                ids = [int(id) for id in raw_idlist]
            except ValueError:
                raise ValidationError({"id": ["Invalid ID format"]})
            queryset = queryset.filter(id__in=ids)

        if raw_query := request.GET.get("query"):
            for filter in parse_detector_query(raw_query):
                assert isinstance(filter, SearchFilter)
                match filter:
                    case SearchFilter(key=SearchKey("name"), operator=("=" | "IN" | "!=")):
                        queryset = apply_filter(queryset, filter, "name")
                    case SearchFilter(key=SearchKey("type"), operator=("=" | "IN" | "!=")):
                        queryset = apply_filter(queryset, filter, "type")
                    case SearchFilter(key=SearchKey("query"), operator="="):
                        # 'query' is our free text key; all free text gets returned here
                        # as '=', and we search any relevant fields for it.
                        queryset = queryset.filter(
                            Q(description__icontains=filter.value.value)
                            | Q(name__icontains=filter.value.value)
                            | Q(type__icontains=filter.value.value)
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

    @extend_schema(
        operation_id="Create a Detector",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
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
            201: DetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a Detector
        ````````````````
        Create a new detector for a project.

        :param string name: The name of the detector
        :param string detector_type: The type of detector to create
        :param object data_source: Configuration for the data source
        :param array data_conditions: List of conditions to trigger the detector
        """
        detector_type = request.data.get("type")
        if not detector_type:
            raise ValidationError({"type": ["This field is required."]})

        # restrict creating metric issue detectors by plan type
        if detector_type == MetricIssue.slug and not features.has(
            "organizations:incidents", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        try:
            project_id = request.data.get("projectId")
            if not project_id:
                raise ValidationError({"projectId": ["This field is required."]})

            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            raise ValidationError({"projectId": ["Project not found"]})

        if project.organization.id != organization.id:
            raise ValidationError({"projectId": ["Project not found"]})

        # TODO: Should be in the validator?
        if not request.access.has_project_access(project):
            return Response(status=status.HTTP_403_FORBIDDEN)

        validator = get_detector_validator(request, project, detector_type)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        detector = validator.save()

        # Handle workflow connections
        workflow_ids = request.data.get("workflowIds", [])
        if workflow_ids:
            for workflow_id in workflow_ids:
                workflow_validator = DetectorWorkflowValidator(
                    data={
                        "detector_id": detector.id,
                        "workflow_id": workflow_id,
                    },
                    context={
                        "organization": organization,
                        "request": request,
                    },
                )
                if not workflow_validator.is_valid():
                    # Clean up the detector if workflow validation fails
                    detector.delete()
                    return Response(workflow_validator.errors, status=status.HTTP_400_BAD_REQUEST)

                workflow_validator.save()

        return Response(serialize(detector, request.user), status=status.HTTP_201_CREATED)
