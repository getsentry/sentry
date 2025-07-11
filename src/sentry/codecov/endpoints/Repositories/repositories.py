from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import PreventParams
from sentry.codecov.base import CodecovEndpoint
from sentry.codecov.client import CodecovApiClient
from sentry.codecov.endpoints.Repositories.query import query
from sentry.codecov.endpoints.Repositories.serializers import RepositoriesSerializer
from sentry.codecov.enums import OrderingDirection

MAX_RESULTS_PER_PAGE = 50


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class RepositoriesEndpoint(CodecovEndpoint):
    __test__ = False

    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieves repository list for a given owner",
        parameters=[
            PreventParams.OWNER,
            PreventParams.FIRST,
            PreventParams.LAST,
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
    def get(self, request: Request, owner: str, **kwargs) -> Response:
        """
        Retrieves repository data for a given owner.
        """

        first_param = request.query_params.get("first")
        last_param = request.query_params.get("last")
        cursor = request.query_params.get("cursor")

        # When calling request.query_params, the URL is decoded so + is replaced with spaces. We need to change them back so Codecov can properly fetch the next page.
        if cursor:
            cursor = cursor.replace(" ", "+")

        try:
            first = int(first_param) if first_param else None
            last = int(last_param) if last_param else None
        except ValueError:
            return Response(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                data={"details": "Query parameters 'first' and 'last' must be integers."},
            )

        if first and last:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "Cannot specify both `first` and `last`"},
            )

        if not first and not last:
            first = MAX_RESULTS_PER_PAGE

        variables = {
            "owner": owner,
            "filters": {"term": request.query_params.get("term")},
            "direction": OrderingDirection.DESC.value,
            "ordering": "COMMIT_DATE",
            "first": first,
            "last": last,
            "before": cursor if cursor and last else None,
            "after": cursor if cursor and first else None,
        }

        client = CodecovApiClient(git_provider_org=owner)
        graphql_response = client.query(query=query, variables=variables)
        repositories = RepositoriesSerializer().to_representation(graphql_response.json())

        return Response(repositories)
