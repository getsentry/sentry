from typing import int, Any

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams, PreventParams
from sentry.codecov.base import CodecovEndpoint
from sentry.codecov.client import CodecovApiClient
from sentry.codecov.endpoints.sync_repos.query import mutation, query
from sentry.codecov.endpoints.sync_repos.serializers import SyncReposSerializer
from sentry.integrations.services.integration.model import RpcIntegration


class SyncReposPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
    }


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class SyncReposEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (SyncReposPermission,)

    @extend_schema(
        operation_id="Syncs repositories from an integrated org with GitHub",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
        ],
        request=None,
        responses={
            200: SyncReposSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, owner: RpcIntegration, **kwargs) -> Response:
        """
        Syncs repositories for an integrated organization with GitHub.
        """

        owner_slug = owner.name

        variables: dict[str, Any] = {}

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=mutation, variables=variables)

        serializer = SyncReposSerializer(context={"http_method": request.method})
        is_syncing = serializer.to_representation(graphql_response.json())

        return Response(is_syncing)

    @extend_schema(
        operation_id="Gets syncing status for repositories for an integrated org",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
        ],
        request=None,
        responses={
            200: SyncReposSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, owner: RpcIntegration, **kwargs) -> Response:
        """
        Gets syncing status for repositories for an integrated organization.
        """

        owner_slug = owner.name

        variables: dict[str, Any] = {}

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=query, variables=variables)

        serializer = SyncReposSerializer(context={"http_method": request.method})
        is_syncing = serializer.to_representation(graphql_response.json())

        return Response(is_syncing)
