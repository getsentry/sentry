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
from sentry.codecov.endpoints.repository_tokens.query import query
from sentry.codecov.endpoints.repository_tokens.serializers import RepositoryTokensSerializer
from sentry.codecov.enums import NavigationParameter, OrderingDirection
from sentry.integrations.services.integration.model import RpcIntegration

MAX_RESULTS_PER_PAGE = 25


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class RepositoryTokensEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieves a paginated list of repository tokens for a given owner",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
            PreventParams.LIMIT,
            PreventParams.NAVIGATION,
            PreventParams.CURSOR,
            PreventParams.TOKENS_SORT_BY,
        ],
        request=None,
        responses={
            200: RepositoryTokensSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, owner: RpcIntegration, **kwargs) -> Response:
        """
        Retrieves a paginated list of repository tokens for a given owner.
        """

        navigation = request.query_params.get("navigation", NavigationParameter.NEXT.value)
        limit_param = request.query_params.get("limit", MAX_RESULTS_PER_PAGE)
        cursor = request.query_params.get("cursor")

        sort_by = request.query_params.get("sortBy", "-COMMIT_DATE")

        # Validate sort parameters
        valid_sort_fields = {"COMMIT_DATE", "NAME"}

        if sort_by.startswith("-"):
            sort_field = sort_by[1:]
            ordering_direction = OrderingDirection.DESC.value
        else:
            sort_field = sort_by
            ordering_direction = OrderingDirection.ASC.value

        if sort_field not in valid_sort_fields:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={
                    "details": f"Invalid sortBy parameter. Allowed values: {', '.join(sorted(valid_sort_fields))}"
                },
            )

        sort_by = sort_field

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
            "direction": ordering_direction,
            "ordering": sort_by,
            "first": limit if navigation != NavigationParameter.PREV.value else None,
            "last": limit if navigation == NavigationParameter.PREV.value else None,
            "before": cursor if cursor and navigation == NavigationParameter.PREV.value else None,
            "after": cursor if cursor and navigation == NavigationParameter.NEXT.value else None,
        }

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=query, variables=variables)
        repository_tokens = RepositoryTokensSerializer().to_representation(graphql_response.json())

        return Response(repository_tokens)
