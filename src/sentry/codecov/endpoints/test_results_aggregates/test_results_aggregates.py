from typing import int
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams, PreventParams
from sentry.codecov.base import CodecovEndpoint
from sentry.codecov.client import CodecovApiClient
from sentry.codecov.endpoints.test_results_aggregates.query import query
from sentry.codecov.endpoints.test_results_aggregates.serializers import (
    TestResultAggregatesSerializer,
)
from sentry.codecov.enums import MeasurementInterval
from sentry.integrations.services.integration.model import RpcIntegration


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class TestResultsAggregatesEndpoint(CodecovEndpoint):
    __test__ = False

    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve aggregated test result metrics for repository, owner, and organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
            PreventParams.REPOSITORY,
            PreventParams.INTERVAL,
            PreventParams.BRANCH,
        ],
        request=None,
        responses={
            200: TestResultAggregatesSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, owner: RpcIntegration, repository: str, **kwargs) -> Response:
        """
        Retrieves aggregated test result metrics for a given repository and owner.
        Also accepts a query parameter to specify the time period for the metrics.
        """

        owner_slug = owner.name

        variables = {
            "owner": owner_slug,
            "repo": repository,
            "branch": request.query_params.get("branch"),
            "interval": request.query_params.get(
                "interval", MeasurementInterval.INTERVAL_30_DAY.value
            ),
        }

        client = CodecovApiClient(git_provider_org=owner_slug)
        graphql_response = client.query(query=query, variables=variables)
        test_results = TestResultAggregatesSerializer().to_representation(graphql_response.json())

        return Response(test_results)
