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
from sentry.codecov.endpoints.TestResults.query import query
from sentry.codecov.endpoints.TestResults.serializers import TestResultSerializer
from sentry.codecov.enums import MeasurementInterval, OrderingDirection, OrderingParameter


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class TestResultsEndpoint(CodecovEndpoint):
    __test__ = False
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    # Disable pagination requirement for this endpoint
    def has_pagination(self, response):
        return True

    @extend_schema(
        operation_id="Retrieve paginated list of test results for repository, owner, and organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            PreventParams.OWNER,
            PreventParams.REPOSITORY,
            PreventParams.TEST_RESULTS_SORT_BY,
            PreventParams.TEST_RESULTS_FILTER_BY,
            PreventParams.INTERVAL,
            PreventParams.BRANCH,
            PreventParams.FIRST,
            PreventParams.LAST,
            PreventParams.CURSOR,
        ],
        request=None,
        responses={
            200: TestResultSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization_id_or_slug: str, owner: str, repository: str, **kwargs
    ) -> Response:
        """Retrieves the list of test results for a given repository and owner. Also accepts a number of query parameters to filter the results."""

        sort_by = request.query_params.get(
            "sortBy", f"-{OrderingParameter.COMMITS_WHERE_FAIL.value}"
        )

        if sort_by.startswith("-"):
            sort_by = sort_by[1:]
            direction = OrderingDirection.DESC.value
        else:
            direction = OrderingDirection.ASC.value

        first_param = request.query_params.get("first")
        last_param = request.query_params.get("last")
        cursor = request.query_params.get("cursor")

        # When calling request.query_params, the URL is decoded so + is replaced with spaces. We need to change them back so Codecov can properly fetch the next page.
        if cursor:
            cursor = cursor.replace(" ", "+")

        first = int(first_param) if first_param else None
        last = int(last_param) if last_param else None

        if first and last:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "Cannot specify both `first` and `last`"},
            )

        if not first and not last:
            first = 20

        variables = {
            "owner": owner,
            "repo": repository,
            "filters": {
                "branch": request.query_params.get("branch", "main"),
                "parameter": request.query_params.get("filterBy"),
                "interval": (
                    request.query_params.get("interval", MeasurementInterval.INTERVAL_30_DAY.value)
                ),
                "flags": None,
                "term": None,
                "test_suites": None,
            },
            "ordering": {
                "direction": direction,
                "parameter": sort_by,
            },
            "first": first,
            "last": last,
            "before": cursor if cursor and last else None,
            "after": cursor if cursor and first else None,
        }

        client = CodecovApiClient(git_provider_org=owner)
        graphql_response = client.query(query=query, variables=variables)

        test_results = TestResultSerializer().to_representation(graphql_response.json())

        return Response(test_results)
