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
from sentry.integrations.api.serializers.rest_framework.data_forwarder import (
    DataForwarderSerializer,
)
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.web.decorators import set_referrer_policy


class OrganizationDataForwardingDetailsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:write"],
    }


@region_silo_endpoint
@extend_schema(tags=["Integrations"])
class DataForwardingDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,  # TODO: might need to change
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationDataForwardingDetailsPermission,)

    @extend_schema(
        operation_id="Retrieve a Data Forwarding Configuration for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: DataForwarderSerializer,
        },
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def get(self, request: Request, organization_context) -> Response:
        data_forwarders = DataForwarder.objects.filter(
            organization_id=organization_context.organization.id
        )
        return self.respond(serialize(data_forwarders, request.user))

    @extend_schema(
        operation_id="Create a Data Forwarding Configuration for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DataForwarderSerializer,
        responses={
            201: DataForwarderSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def post(self, request: Request, organization_context) -> Response:
        data = request.data.copy()
        data["organization_id"] = organization_context.organization.id

        serializer = DataForwarderSerializer(data=data)
        if serializer.is_valid():
            data_forwarder = serializer.save()

            self.create_audit_entry(
                request=request,
                organization=organization_context.organization,
                target_object=data_forwarder.id,
                event=audit_log.get_event_id("DATA_FORWARDER_ADD"),
                data={
                    "provider": data_forwarder.provider,
                    "organization_id": data_forwarder.organization_id,
                },
            )

            return self.respond(
                serialize(data_forwarder, request.user), status=status.HTTP_201_CREATED
            )
        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
