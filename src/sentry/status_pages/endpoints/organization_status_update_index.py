from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, StatusPageParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.status_pages.endpoints.serializers.status_update import (
    StatusUpdateResponseSerializer,
    StatusUpdateSerializer,
)
from sentry.status_pages.models.status_page import StatusPage
from sentry.status_pages.models.status_update import StatusUpdate
from sentry.status_pages.models.status_update_detector import StatusUpdateDetector


@extend_schema(tags=["Status Pages"])
@region_silo_endpoint
class OrganizationStatusUpdateIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS

    def convert_args(self, request: Request, status_page_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            status_page = StatusPage.objects.get(id=status_page_id)
            if status_page.organization_id != kwargs["organization"].id:
                raise ResourceDoesNotExist
            kwargs["status_page"] = status_page
        except StatusPage.DoesNotExist:
            raise ResourceDoesNotExist
        return args, kwargs

    @extend_schema(
        operation_id="List Status Updates for a Status Page",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            StatusPageParams.STATUS_PAGE_ID,
            CursorQueryParam,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListStatusUpdatesResponse", list[StatusUpdateResponseSerializer]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization, status_page) -> Response:
        """
        List all status updates for an organization's status pages.
        Supports filtering by status types and detectors.
        """
        queryset = StatusUpdate.objects.filter(status_page=status_page).select_related(
            "status_page", "parent_update"
        )

        # Filter by status types
        status_types = request.GET.getlist("status_type")
        if status_types:
            queryset = queryset.filter(type__in=status_types)

        # Filter by detectors
        detector_ids = request.GET.getlist("detector")
        if detector_ids:
            try:
                detector_ids = [int(detector_id) for detector_id in detector_ids]
                queryset = queryset.filter(
                    id__in=StatusUpdateDetector.objects.filter(
                        detector_id__in=detector_ids
                    ).values_list("status_update_id", flat=True)
                )
            except ValueError:
                return Response({"detail": "Invalid detector ID format"}, status=400)

        # Filter by status page
        status_page_id = request.GET.get("status_page")
        if status_page_id:
            try:
                status_page_id = int(status_page_id)
                queryset = queryset.filter(status_page_id=status_page_id)
            except ValueError:
                return Response({"detail": "Invalid status page ID format"}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-start_time",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, StatusUpdateResponseSerializer()),
        )

    @extend_schema(
        operation_id="Create a Status Update",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, StatusPageParams.STATUS_PAGE_ID],
        request=StatusUpdateSerializer,
        responses={
            201: StatusUpdateResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization, status_page) -> Response:
        """
        Create a new status update for a status page.
        """
        serializer = StatusUpdateSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        # Get parent update if specified
        parent_update = None
        if data.get("parent_update"):
            try:
                parent_update = StatusUpdate.objects.get(
                    id=data["parent_update"], status_page__organization=organization
                )
            except StatusUpdate.DoesNotExist:
                return Response({"detail": "Parent status update not found"}, status=404)

        # Create the status update
        status_update = StatusUpdate.objects.create(
            status_page=status_page,
            title=data["title"],
            description=data.get("description"),
            type=data["type"],
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            parent_update=parent_update,
            should_notify_subscribers_now=data.get("should_notify_subscribers_now", False),
            should_notify_subscribers_at_end=data.get("should_notify_subscribers_at_end", False),
            should_notify_subscribers_24h_before=data.get(
                "should_notify_subscribers_24h_before", False
            ),
        )

        return Response(
            serialize(status_update, request.user, StatusUpdateResponseSerializer()),
            status=201,
        )
