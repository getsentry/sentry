from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.api.serializers.rest_framework.data_forwarder import (
    DataForwarderSerializer,
)
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.utils.audit import create_audit_entry
from sentry.web.decorators import set_referrer_policy


class OrganizationDataForwardingPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "org:integrations"],
        "POST": ["org:write", "org:admin", "org:integrations"],
    }


@extend_schema(tags=["Integrations"])
@region_silo_endpoint
class OrganizationDataForwardingEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDataForwardingPermission,)
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List an Organization's Data Forwarding Configurations",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer("ListDataForwarderResponse", list[dict]),
        },
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def get(self, request: Request, organization_context) -> Response:
        """
        Retrieve the forwarding configs for an organization.
        Also retrieves project overrides for the given configs.
        """
        data_forwarders = DataForwarder.objects.filter(
            organization_id=organization_context.organization.id
        ).prefetch_related("projects__project")

        return self.respond(serialize(data_forwarders, request.user))

    @extend_schema(
        operation_id="Create a Data Forwarding Configuration",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DataForwarderSerializer,
        responses={
            201: inline_sentry_response_serializer("DataForwarderResponse", dict),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def post(self, request: Request, organization_context) -> Response:
        """
        Create a forwarding config for an organization.
        """
        data = request.data.copy()
        data["organization_id"] = organization_context.organization.id

        serializer = DataForwarderSerializer(data=data)
        if serializer.is_valid():
            data_forwarder = serializer.save()

            # Create audit log entry
            create_audit_entry(
                request=request,
                organization_id=organization_context.organization.id,
                target_object=data_forwarder.id,
                event=audit_log.get_event_id("DATA_FORWARDER_ADD"),
                data={
                    "provider": data_forwarder.provider,
                    "organization_id": data_forwarder.organization_id,
                },
            )

            return self.respond(
                serialize(data_forwarder, request.user),
                status=status.HTTP_201_CREATED,
            )

        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
