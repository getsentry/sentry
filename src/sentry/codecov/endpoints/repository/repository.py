from typing import int
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams, PreventParams
from sentry.codecov.base import CodecovEndpoint
from sentry.codecov.client import CodecovApiClient
from sentry.codecov.endpoints.repository.query import query
from sentry.codecov.endpoints.repository.serializers import RepositorySerializer
from sentry.integrations.services.integration.model import RpcIntegration


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class RepositoryEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieves a single repository for a given owner",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
            PreventParams.REPOSITORY,
        ],
        request=None,
        responses={
            200: RepositorySerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, owner: RpcIntegration, **kwargs) -> Response:
        """
        Retrieves repository data for a single repository.
        """
        repository = kwargs.get("repository")
        if not repository:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "repository parameter is required"},
            )

        owner_slug = owner.name

        variables = {
            "owner": owner_slug,
            "repo": repository,
        }

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=query, variables=variables)

        response_data = graphql_response.json()
        repository_data = response_data.get("data", {}).get("owner", {}).get("repository")

        if not repository_data:
            return Response(
                status=status.HTTP_404_NOT_FOUND,
                data={"details": f"Repository '{repository}' not found"},
            )

        if repository_data.get("__typename") in ["NotFoundError", "OwnerNotActivatedError"]:
            return Response(
                status=status.HTTP_404_NOT_FOUND,
                data={
                    "details": repository_data.get(
                        "message", f"Repository '{repository}' not found"
                    )
                },
            )
        result = RepositorySerializer().to_representation(response_data)
        return Response(result)
