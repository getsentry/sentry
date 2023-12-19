from typing import List

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.relay import OrganizationRelayResponse
from sentry.apidocs.constants import RESPONSE_NOT_FOUND
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.relay import RelayUsage


@extend_schema(tags=["Organizations"])
@region_silo_endpoint
class OrganizationRelayUsage(OrganizationEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="List an Organization's trusted Relays",
        parameters=[GlobalParams.ORG_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationRelayResponse", List[OrganizationRelayResponse]
            ),
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationExamples.LIST_RELAYS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Return a list of trusted relays bound to an organization.

        If the organization doesn't have Relay usage enabled it returns a 404.
        """
        has_relays = features.has("organizations:relay", organization, actor=request.user)
        if not has_relays:
            return Response(status=404)

        option_key = "sentry:trusted-relays"
        trusted_relays = organization.get_option(option_key)
        if trusted_relays is None or len(trusted_relays) == 0:
            return Response([], status=200)

        keys = [val.get("public_key") for val in trusted_relays]
        relay_history = list(RelayUsage.objects.filter(public_key__in=keys).order_by("-last_seen"))

        return Response(serialize(relay_history, request.user))
