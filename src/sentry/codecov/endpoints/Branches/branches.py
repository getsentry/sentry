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

MAX_RESULTS_PER_PAGE = 50


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class BranchesEndpoint(CodecovEndpoint):
    __test__ = False

    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieves branch list for a given owner and repository",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
            PreventParams.REPOSITORY,
            PreventParams.FIRST,
            PreventParams.LAST,
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

        first_param = request.query_params.get("first")
        last_param = request.query_params.get("last")
        cursor = request.query_params.get("cursor")

        # When calling request.query_params, the URL is decoded so + is replaced with spaces. We need to change them back so Codecov can properly fetch the next page.
        if cursor:
            cursor = cursor.replace(" ", "+")

        try:
            first = int(first_param) if first_param is not None else None
            last = int(last_param) if last_param is not None else None
        except ValueError:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "Query parameters 'first' and 'last' must be integers."},
            )

        if first is not None and last is not None:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "Cannot specify both `first` and `last`"},
            )

        if first is None and last is None:
            first = MAX_RESULTS_PER_PAGE

        variables = {
            "owner": owner,
            "repo": repository,
            "filters": {"searchValue": request.query_params.get("term")},
            "first": first,
            "last": last,
            "before": cursor if cursor and last else None,
            "after": cursor if cursor and first else None,
        }

        client = CodecovApiClient(git_provider_org=owner)
        graphql_response = client.query(query=query, variables=variables)
        branches = BranchesSerializer().to_representation(graphql_response.json())

        return Response(branches)
