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
from sentry.codecov.endpoints.Branches.query import query
from sentry.codecov.endpoints.Branches.serializers import BranchesSerializer
from sentry.codecov.enums import NavigationParameter

MAX_RESULTS_PER_PAGE = 50


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class RepositoryBranchesEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieves list of branches for a given owner and repository",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
            PreventParams.REPOSITORY,
            PreventParams.LIMIT,
            PreventParams.NAVIGATION,
            PreventParams.CURSOR,
            PreventParams.TERM,
        ],
        request=None,
        responses={
            200: BranchesSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, owner: str, repository: str, **kwargs) -> Response:
        """
        Retrieves branch data for a given owner and repository.
        """

        navigation = request.query_params.get("navigation", NavigationParameter.NEXT.value)
        limit_param = request.query_params.get("limit", MAX_RESULTS_PER_PAGE)
        cursor = request.query_params.get("cursor")

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
            "owner": owner,
            "repo": repository,
            "filters": {"searchValue": request.query_params.get("term")},
            "first": limit if navigation != NavigationParameter.PREV.value else None,
            "last": limit if navigation == NavigationParameter.PREV.value else None,
            "before": cursor if cursor and navigation == NavigationParameter.PREV.value else None,
            "after": cursor if cursor and navigation == NavigationParameter.NEXT.value else None,
        }

        client = CodecovApiClient(git_provider_org=owner)
        graphql_response = client.query(query=query, variables=variables)
        branches = BranchesSerializer().to_representation(graphql_response.json())

        return Response(branches)
