from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_CONFLICT, RESPONSE_FORBIDDEN
from sentry.apidocs.parameters import GlobalParams
from sentry.integrations.api.serializers.models.data_forwarder import (
    DataForwarderSerializer as DataForwarderModelSerializer,
)
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
class DataForwardingIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationDataForwardingDetailsPermission,)

    @extend_schema(
        operation_id="Retrieve Data Forwarding Configurations for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: DataForwarderModelSerializer,
        },
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def get(self, request: Request, organization) -> Response:
        queryset = DataForwarder.objects.filter(organization_id=organization.id)

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        operation_id="Create a Data Forwarding Configuration for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DataForwarderSerializer,
        responses={
            201: DataForwarderModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            409: RESPONSE_CONFLICT,
        },
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def post(self, request: Request, organization) -> Response:
        data = request.data
        data["organization_id"] = organization.id

        serializer = DataForwarderSerializer(data=data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return self.respond(
            serialize(serializer.save(), request.user), status=status.HTTP_201_CREATED
        )
