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
from sentry.codecov.endpoints.TestResultsAggregates.query import query
from sentry.codecov.endpoints.TestResultsAggregates.serializers import (
    TestResultAggregatesSerializer,
)
from sentry.codecov.enums import MeasurementInterval


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class TestResultsAggregatesEndpoint(CodecovEndpoint):
    __test__ = False

    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve aggregated test result metrics for repository and owner",
        parameters=[
            PreventParams.OWNER,
            PreventParams.REPOSITORY,
            PreventParams.INTERVAL,
        ],
        request=None,
        responses={
            200: TestResultAggregatesSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, owner: str, repository: str, **kwargs) -> Response:
        """
        Retrieves aggregated test result metrics for a given repository and owner.
        Also accepts a query parameter to specify the time period for the metrics.
        """

        variables = {
            "owner": owner,
            "repo": repository,
            "interval": request.query_params.get(
                "interval", MeasurementInterval.INTERVAL_30_DAY.value
            ),
        }

        client = CodecovApiClient(git_provider_org=owner)
        graphql_response = client.query(query=query, variables=variables)
        test_results = TestResultAggregatesSerializer().to_representation(graphql_response.json())

        return Response(test_results)
