from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.api.serializers.models.data_forwarder import DataForwarderResponse
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
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationDataForwardingDetailsPermission,)

    def convert_args(self, request: Request, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        if not features.has("organizations:data-forwarding-revamp-access", kwargs["organization"]):
            raise PermissionDenied(
                "This feature is in a limited preview. Reach out to support@sentry.io for access."
            )
        return args, kwargs

    @extend_schema(
        operation_id="Retrieve Data Forwarders for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "ListDataForwarderResponse", list[DataForwarderResponse]
            )
        },
        examples=IntegrationExamples.LIST_DATA_FORWARDERS,
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def get(self, request: Request, organization) -> Response:
        """
        Returns a list of data forwarders for an organization.
        """
        queryset = DataForwarder.objects.filter(organization_id=organization.id)

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        operation_id="Create a Data Forwarder for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DataForwarderSerializer,
        responses={
            201: inline_sentry_response_serializer("DataForwarderResponse", DataForwarderResponse),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=IntegrationExamples.SINGLE_DATA_FORWARDER,
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def post(self, request: Request, organization) -> Response:
        """
        Creates a new data forwarder for an organization.
        Only one data forwarder can be created per provider for a given organization.

        Project-specific overrides can only be created after creating the data forwarder.
        """
        if not features.has("organizations:data-forwarding", organization):
            return self.respond(status=status.HTTP_403_FORBIDDEN)

        data = request.data
        data["organization_id"] = organization.id

        serializer = DataForwarderSerializer(data=data, context={"organization": organization})
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return self.respond(
            serialize(serializer.save(), request.user), status=status.HTTP_201_CREATED
        )
