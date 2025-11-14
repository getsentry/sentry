from typing import int
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
from sentry.codecov.endpoints.repository_token_regenerate.query import query
from sentry.codecov.endpoints.repository_token_regenerate.serializers import (
    RepositoryTokenRegenerateSerializer,
)
from sentry.integrations.services.integration.model import RpcIntegration


class RepositoryTokenRegeneratePermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
    }


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class RepositoryTokenRegenerateEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (RepositoryTokenRegeneratePermission,)

    @extend_schema(
        operation_id="Regenerates a repository upload token and returns the new token",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
            PreventParams.REPOSITORY,
        ],
        request=None,
        responses={
            200: RepositoryTokenRegenerateSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, owner: RpcIntegration, repository: str, **kwargs) -> Response:
        """
        Regenerates a repository upload token and returns the new token.
        """

        owner_slug = owner.name

        variables = {
            "owner": owner_slug,
            "repoName": repository,
        }

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=query, variables=variables)
        token = RepositoryTokenRegenerateSerializer().to_representation(graphql_response.json())

        return Response(token)
