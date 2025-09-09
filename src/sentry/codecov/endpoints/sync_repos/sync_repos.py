from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.codecov.base import CodecovEndpoint
from sentry.codecov.client import CodecovApiClient
from sentry.codecov.endpoints.sync_repos.query import mutation, query
from sentry.codecov.endpoints.sync_repos.serializers import SyncReposSerializer
from sentry.integrations.services.integration.model import RpcIntegration


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class SyncReposEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Syncs repositories from an integrated org with GitHub",
        parameters=[],
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

        variables = {}

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=mutation, variables=variables)
        serializer = SyncReposSerializer(context={"request": request})
        is_syncing = serializer.to_representation(graphql_response.json())

        return Response(is_syncing)

    @extend_schema(
        operation_id="Gets syncing status from an integrated org",
        parameters=[],
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
        Gets syncing status for repositories in integrated organization.
        """

        owner_slug = owner.name

        variables = {}

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=query, variables=variables)
        serializer = SyncReposSerializer(context={"request": request})
        is_syncing = serializer.to_representation(graphql_response.json())

        return Response(is_syncing)
