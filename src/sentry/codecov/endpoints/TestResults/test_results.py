from enum import Enum

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
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


@region_silo_endpoint
class TestResultsEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    # Disable pagination requirement for this endpoint
    def has_pagination(self, response):
        return True

    def get(self, request: Request, owner: str, repository: str) -> Response:
        """Retrieves the list of test results for a given repository and owner. Also accepts a number of query parameters to filter the results."""

        owner = "codecov"
        repository = "gazebo"
        branch = "main"

        variables = {
            "owner": owner,
            "repo": repository,
            "filters": {
                "branch": branch,
                "flags": None,
                "interval": MeasurementInterval.INTERVAL_1_DAY.value,
                "parameter": TestResultsFilterParameter.FLAKY_TESTS.value,
                "term": None,
                "test_suites": None,
            },
            "ordering": {
                "direction": OrderingDirection.DESC.value,
                "parameter": OrderingParameter.UPDATED_AT.value,
            },
            "first": 10,
        }

        graphql_response = CodecovApiClient.query(query, variables)

        test_results = TestResultSerializer().to_representation(graphql_response)

        return Response(test_results)
