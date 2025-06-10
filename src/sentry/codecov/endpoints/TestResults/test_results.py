from enum import Enum

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
from sentry.codecov.endpoints.TestResults.query import query
from sentry.codecov.endpoints.TestResults.serializers import TestResultSerializer


class OrderingDirection(Enum):
    DESC = "DESC"
    ASC = "ASC"


class OrderingParameter(Enum):
    AVG_DURATION = "AVG_DURATION"
    FLAKE_RATE = "FLAKE_RATE"
    FAILURE_RATE = "FAILURE_RATE"
    COMMITS_WHERE_FAIL = "COMMITS_WHERE_FAIL"
    UPDATED_AT = "UPDATED_AT"


class TestResultsFilterParameter(Enum):
    FLAKY_TESTS = "FLAKY_TESTS"
    FAILED_TESTS = "FAILED_TESTS"
    SLOWEST_TESTS = "SLOWEST_TESTS"
    SKIPPED_TESTS = "SKIPPED_TESTS"


class MeasurementInterval(Enum):
    INTERVAL_30_DAY = "INTERVAL_30_DAY"
    INTERVAL_7_DAY = "INTERVAL_7_DAY"
    INTERVAL_1_DAY = "INTERVAL_1_DAY"


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class TestResultsEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    # Disable pagination requirement for this endpoint
    def has_pagination(self, response):
        return True

    @extend_schema(
        operation_id="Retrieve a paginated list of test results for a given repository and owner",
        parameters=[
            PreventParams.OWNER,
            PreventParams.REPOSITORY,
            PreventParams.TEST_RESULTS_SORT_BY,
            PreventParams.TEST_RESULTS_ORDER_BY,
            PreventParams.INTERVAL,
            PreventParams.BRANCH,
            PreventParams.FIRST,
            PreventParams.LAST,
        ],
        request=None,
        responses={
            200: TestResultSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, owner: str, repository: str, **kwargs) -> Response:
        """Retrieves the list of test results for a given repository and owner. Also accepts a number of query parameters to filter the results."""

        owner_var = owner if owner else "codecov"
        repository_var = repository if repository else "gazebo"

        order_by = (
            request.query_params.get("orderBy")
            if request.query_params.get("orderBy")
            else OrderingParameter.COMMITS_WHERE_FAIL.value
        )
        if order_by.startswith("-"):
            order_by = order_by[1:]
            direction = OrderingDirection.DESC.value
        else:
            direction = OrderingDirection.ASC.value

        first = (
            int(request.query_params.get("first")) if request.query_params.get("first") else None
        )
        last = int(request.query_params.get("last")) if request.query_params.get("last") else None

        if not first and not last:
            first = 20
        if first and last:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "Cannot specify both `first` and `last`"},
            )

        variables = {
            "owner": owner_var,
            "repo": repository_var,
            "filters": {
                "branch": (
                    request.query_params.get("branch")
                    if request.query_params.get("branch")
                    else "main"
                ),
                "parameter": (
                    request.query_params.get("sortBy")
                    if request.query_params.get("sortBy")
                    else None
                ),
                "interval": (
                    request.query_params.get("interval")
                    if request.query_params.get("interval")
                    else MeasurementInterval.INTERVAL_30_DAY.value
                ),
                "flags": None,
                "term": None,
                "test_suites": None,
            },
            "ordering": {
                "direction": direction,
                "parameter": order_by,
            },
            "first": first,
            "last": last,
        }

        client = CodecovApiClient(git_provider_org="codecov")
        graphql_response = client.query(query=query, variables=variables)

        test_results = TestResultSerializer().to_representation(graphql_response.json())

        return Response(test_results)
