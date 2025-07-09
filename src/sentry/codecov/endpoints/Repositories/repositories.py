from drf_spectacular.utils import extend_schema
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

        variables = {
            "owner": owner,
            "direction": OrderingDirection.DESC.value,
            "ordering": "COMMIT_DATE",
            "first": MAX_RESULTS_PER_PAGE,
            "filters": {"term": request.query_params.get("term")},
        }

        client = CodecovApiClient(git_provider_org=owner)
        graphql_response = client.query(query=query, variables=variables)
        repositories = RepositoriesSerializer().to_representation(graphql_response.json())

        return Response(repositories)
