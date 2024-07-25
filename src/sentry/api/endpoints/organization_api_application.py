"""Management interface for organization defined and scoped API applications.

As of time of writing this resource is used exclusively for provisioning API applications for the
Sentry dev-toolbar. A unique constraint is placed on the API application's organization foreign-key
limiting the number of organiation-tied API applications to one.

The purpose of this resource is to allow users to authenticate with Sentry from a remote origin. In
other words, a Sentry user is authorizing a piece of code not under the control of Sentry to make
requests on their behalf to Sentry servers.
"""

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ListField

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationAdminPermission,
)
from sentry.api.serializers import Serializer, serialize
from sentry.models.apiapplication import ApiApplication


class ApiApplicationValidator(serializers.Serializer):
    allowedOrigins = ListField(
        child=serializers.URLField(max_length=255),
        required=True,
        allow_null=False,
    )
    redirectUris = ListField(
        child=serializers.URLField(max_length=255),
        required=True,
        allow_null=False,
    )


class ApiApplicationSerializer(Serializer):
    def serialize(self, obj: ApiApplication, attrs, user, **kwargs):
        return {
            "id": obj.client_id,
            "allowedOrigins": obj.get_allowed_origins(),
            "redirectUris": obj.get_redirect_uris(),
        }


@control_silo_endpoint
class OrganizationApiApplicationIndexEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationAdminPermission,)

    def get(self, request: Request, organization_context, organization) -> Response:
        """Fetch organization API Application."""
        try:
            application = ApiApplication.objects.filter(organization_id=organization.id).get()
            return Response(
                serialize(application, request.user, ApiApplicationSerializer()),
                status=status.HTTP_200_OK,
            )
        except ApiApplication.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    def post(self, request: Request, organization_context, organization) -> Response:
        """Create organization API Application."""
        serializer = ApiApplicationValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.validated_data

        try:
            ApiApplication.objects.filter(organization_id=organization.id).get()
            return Response(status=status.HTTP_200_OK)
        except ApiApplication.DoesNotExist:
            pass

        application = ApiApplication.objects.create(
            owner_id=request.user.id,
            allowed_origins="\n".join(result["allowedOrigins"]),
            redirect_uris="\n".join(result["redirectUris"]),
            organization_id=organization.id,
        )

        self.create_audit_entry(
            request,
            organization=organization,
            event=audit_log.get_event_id("ORGANIZATION_APIAPPLICATION_ADD"),
        )

        return Response(
            serialize(application, request.user, ApiApplicationSerializer()),
            status=status.HTTP_201_CREATED,
        )

    def put(self, request: Request, organization_context, organization) -> Response:
        serializer = ApiApplicationValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.validated_data

        try:
            application = ApiApplication.objects.filter(organization_id=organization.id).get()
            application.allowed_origins = "\n".join(result["allowedOrigins"])
            application.redirect_uris = "\n".join(result["redirectUris"])
            application.save()
        except ApiApplication.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        self.create_audit_entry(
            request,
            organization=organization,
            event=audit_log.get_event_id("ORGANIZATION_APIAPPLICATION_UPDATE"),
        )

        return Response(
            serialize(application, request.user, ApiApplicationSerializer()),
            status=status.HTTP_202_ACCEPTED,
        )

    def delete(self, request: Request, organization_context, organization) -> Response:
        try:
            application = ApiApplication.objects.filter(organization_id=organization.id).get()
            application.delete()
        except ApiApplication.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        self.create_audit_entry(
            request,
            organization=organization,
            event=audit_log.get_event_id("ORGANIZATION_APIAPPLICATION_DELETE"),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
