from django.db import router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, StatusPageParams
from sentry.models.organization import Organization
from sentry.status_pages.endpoints.serializers.status_page import (
    StatusPageResponseSerializer,
    StatusPageSerializer,
)
from sentry.status_pages.models.status_page import StatusPage
from sentry.utils.audit import create_audit_entry


@region_silo_endpoint
@extend_schema(tags=["Status Pages"])
class OrganizationStatusPageDetailsEndpoint(OrganizationEndpoint):
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

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Fetch a Status Page",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            StatusPageParams.STATUS_PAGE_ID,
        ],
        responses={
            200: StatusPageResponseSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, status_page: StatusPage):
        """
        Fetch a status page
        `````````````````````````
        Return details on an individual status page.
        """
        serialized_status_page = serialize(
            status_page,
            request.user,
            StatusPageResponseSerializer(),
        )
        return Response(serialized_status_page)

    @extend_schema(
        operation_id="Update a Status Page",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            StatusPageParams.STATUS_PAGE_ID,
        ],
        request=StatusPageSerializer,
        responses={
            200: StatusPageResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, organization: Organization, status_page: StatusPage
    ) -> Response:
        """
        Update a Status Page
        ```````````````````
        Update an existing status page for an organization.
        """
        serializer = StatusPageSerializer(data=request.data, instance=status_page, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_status_page = serializer.save()
        return Response(
            serialize(updated_status_page, request.user, StatusPageResponseSerializer()),
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        operation_id="Delete a Status Page",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            StatusPageParams.STATUS_PAGE_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization: Organization, status_page: StatusPage):
        """
        Delete a status page
        """
        with transaction.atomic(router.db_for_write(StatusPage)):
            status_page.delete()
            create_audit_entry(
                request=request,
                organization=organization,
                target_object=status_page.id,
                event=audit_log.get_event_id("STATUS_PAGE_REMOVE"),
                data={"title": status_page.title},
            )
        return Response(status=204)
