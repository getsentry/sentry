# PUT and DELETE specific data forwarder configs

# from rest_framework.request import Request
# from rest_framework.response import Response

from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.hybridcloud.rpc import RpcUserOrganizationContext
from sentry.integrations.api.serializers.rest_framework.data_forwarder import (
    DataForwarderSerializer,
)
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject


class OrganizationDataForwardingPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["org:write"],
        "DELETE": ["org:write"],
    }


@region_silo_endpoint
class DataForwardingDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDataForwardingPermission,)
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    def put(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        data_forwarder_id: int,
    ) -> Response:
        data = request.data
        data["organization_id"] = organization_context.organization.id
        serializer = DataForwarderSerializer(data=data)
        if serializer.is_valid():
            data_forwarder = serializer.save()
            return self.respond(serialize(data_forwarder, request.user))
        return self.respond(serializer.errors, status=400)

    def delete(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        data_forwarder_id: int,
    ) -> Response:
        # also removes project overrides associated with the data forwarder

        if not request.user.is_authenticated:
            return Response(status=401)

        try:
            data_forwarder = DataForwarder.objects.get(
                id=data_forwarder_id, organization_id=organization_context.organization.id
            )
        except DataForwarder.DoesNotExist:
            return self.respond(status=404)

        with transaction.atomic(router.db_for_write(DataForwarder)):
            DataForwarderProject.objects.filter(data_forwarder=data_forwarder).delete()
            data_forwarder.delete()

        return Response(serialize(data_forwarder, request.user), status=202)
