from __future__ import annotations

from django.db.models import Exists, OuterRef, Q
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationsBaseEndpoint,
    organization_project_ids,
    require_authenticated_user,
    service_error,
    user_id,
)
from sentry.investigations.endpoints.serializers import (
    InvestigationDetailsSerializer,
    InvestigationDetailsSerializerResponse,
    InvestigationSerializer,
    InvestigationSerializerResponse,
)
from sentry.investigations.endpoints.validators import InvestigationCreateValidator
from sentry.investigations.models import (
    Investigation,
    InvestigationStatus,
)
from sentry.investigations.services import (
    create_agentic_breached_metric_investigation,
    create_agentic_manual_investigation,
    create_manual_investigation,
    resolve_investigation_source,
)
from sentry.investigations.telemetry import record_investigation_started
from sentry.models.organization import Organization
from sentry.viewer_context import ActorId, ActorType


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationsIndexEndpoint(OrganizationInvestigationsBaseEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="List an Organization's Investigations",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.STATUS,
            InvestigationParams.QUERY,
            InvestigationParams.CURSOR,
            InvestigationParams.PER_PAGE,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListanOrganizationsInvestigationsResponse", list[InvestigationSerializerResponse]
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        List the latest revision of each investigation lineage, newest updated first. Returns a
        paginated array of summaries; follow the Link header for more results. Requires the
        organizations:investigations feature and open organization membership.
        """
        requested_status = request.GET.get("status", InvestigationStatus.ACTIVE)
        if requested_status not in InvestigationStatus.values:
            return Response(
                {"detail": "Must be active or archived."}, status=status.HTTP_400_BAD_REQUEST
            )
        # A source-backed investigation supersedes earlier revisions of the same
        # lineage, so only the newest revision is listed.
        newer_lineage_revision = Investigation.objects.filter(
            organization_id=OuterRef("organization_id"),
            source_key=OuterRef("source_key"),
            status=requested_status,
            source_revision__gt=OuterRef("source_revision"),
        )
        investigations = Investigation.objects.filter(
            organization=organization, status=requested_status
        ).filter(Q(source_key__isnull=True) | ~Exists(newer_lineage_revision))
        query = request.GET.get("query")
        if query:
            investigations = investigations.filter(title__icontains=query)
        return self.paginate(
            request=request,
            queryset=investigations,
            paginator_cls=DateTimePaginator,
            order_by="-date_updated",
            on_results=lambda values: serialize(
                list(values),
                request.user,
                InvestigationSerializer(),
            ),
        )

    @extend_schema(
        operation_id="Create an Investigation",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=InvestigationCreateValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", InvestigationDetailsSerializerResponse
            ),
            201: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", InvestigationDetailsSerializerResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={"title": "Checkout latency", "projectIds": [1]},
                request_only=True,
            )
        ],
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a blank notebook with title, or supply source to start an agentic investigation.
        A manual source without a non-blank prompt waits for input. Metric sources resolve their
        context server-side and may reuse an existing active investigation (200); new
        investigations return 201. Returns notebook details, blocks, parameters, and
        orchestration summary. Requires an authenticated user. Requires the
        organizations:investigations feature and open organization membership.
        """
        require_authenticated_user(request)
        validator = InvestigationCreateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        values = validator.validated_data
        project_ids = organization_project_ids(organization)
        try:
            if "source" in values:
                source = values["source"]
                requested_project_ids = values.get("project_ids", [])
                if source["type"] == "metric_open_period":
                    resolved_source = resolve_investigation_source(
                        organization=organization,
                        source=source,
                        accessible_project_ids=project_ids,
                    )
                    requested_project_ids = sorted(
                        set(requested_project_ids) | {resolved_source.project_id}
                    )
                    if not set(requested_project_ids).issubset(project_ids):
                        return Response(
                            {"detail": "One or more projects are inaccessible."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    investigation, created = create_agentic_breached_metric_investigation(
                        organization=organization,
                        creator=ActorId(ActorType.USER, user_id(request)),
                        title=values.get("title"),
                        resolved_source=resolved_source,
                        project_ids=requested_project_ids,
                        filters=values.get("filters", {}),
                    )
                else:
                    if not set(requested_project_ids).issubset(project_ids):
                        return Response(
                            {"detail": "One or more projects are inaccessible."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    created = True
                    investigation, _ = create_agentic_manual_investigation(
                        organization=organization,
                        creator=ActorId(ActorType.USER, user_id(request)),
                        title=values.get("title"),
                        source=source,
                        project_ids=requested_project_ids,
                        filters=values.get("filters", {}),
                    )
            else:
                created = True
                requested_project_ids = values.get("project_ids", [])
                if not set(requested_project_ids).issubset(project_ids):
                    return Response(
                        {"detail": "One or more projects are inaccessible."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                investigation = create_manual_investigation(
                    organization=organization,
                    user_id=user_id(request),
                    title=values["title"],
                    project_ids=requested_project_ids,
                    filters=values.get("filters", {}),
                )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        if created:
            record_investigation_started(investigation)
        return Response(
            serialize(
                investigation,
                request.user,
                InvestigationDetailsSerializer(access=request.access),
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
