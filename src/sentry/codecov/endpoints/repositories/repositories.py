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
from sentry.codecov.endpoints.repositories.query import query
from sentry.codecov.endpoints.repositories.serializers import RepositoriesSerializer
from sentry.codecov.enums import NavigationParameter, OrderingDirection
from sentry.integrations.services.integration.model import RpcIntegration

MAX_RESULTS_PER_PAGE = 50


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class RepositoriesEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieves list of repositories for a given owner",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
            PreventParams.LIMIT,
            PreventParams.NAVIGATION,
            PreventParams.CURSOR,
            PreventParams.TERM,
        ],
        request=None,
        responses={
            200: RepositoriesSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, owner: RpcIntegration, **kwargs) -> Response:
        """
        Retrieves repository data for a given owner.
        """

        navigation = request.query_params.get("navigation", NavigationParameter.NEXT.value)
        limit_param = request.query_params.get("limit", MAX_RESULTS_PER_PAGE)
        cursor = request.query_params.get("cursor")

        owner_slug = owner.name

        # When calling request.query_params, the URL is decoded so + is replaced with spaces. We need to change them back so Codecov can properly fetch the next page.
        if cursor:
            cursor = cursor.replace(" ", "+")

        try:
            limit = int(limit_param)
        except ValueError:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "provided `limit` parameter must be a positive integer"},
            )

        if limit <= 0:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "provided `limit` parameter must be a positive integer"},
            )

        variables = {
            "owner": owner_slug,
            "filters": {"term": request.query_params.get("term")},
            "direction": OrderingDirection.DESC.value,
            "ordering": "COMMIT_DATE",
            "first": limit if navigation != NavigationParameter.PREV.value else None,
            "last": limit if navigation == NavigationParameter.PREV.value else None,
            "before": cursor if cursor and navigation == NavigationParameter.PREV.value else None,
            "after": cursor if cursor and navigation == NavigationParameter.NEXT.value else None,
        }

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=query, variables=variables)
        repositories = RepositoriesSerializer().to_representation(graphql_response.json())

        return Response(repositories)
