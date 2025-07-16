import logging

import sentry_sdk
from rest_framework import serializers

from sentry.codecov.endpoints.serializers import PageInfoSerializer

logger = logging.getLogger(__name__)


class TestResultNodeSerializer(serializers.Serializer):
    """
    Serializer for individual test result nodes from GraphQL response
    """

    __test__ = False

    updatedAt = serializers.CharField()
    avgDuration = serializers.FloatField()
    totalDuration = serializers.FloatField()
    name = serializers.CharField()
    failureRate = serializers.FloatField()
    flakeRate = serializers.FloatField()
    commitsFailed = serializers.IntegerField()
    totalFailCount = serializers.IntegerField()
    totalFlakyFailCount = serializers.IntegerField()
    totalSkipCount = serializers.IntegerField()
    totalPassCount = serializers.IntegerField()
    lastDuration = serializers.FloatField()


class TestResultSerializer(serializers.Serializer):
    """
    Serializer for test results response including pagination metadata
    """

    __test__ = False

    results = TestResultNodeSerializer(many=True)
    pageInfo = PageInfoSerializer()
    totalCount = serializers.IntegerField()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            test_results_data = graphql_response["data"]["owner"]["repository"]["testAnalytics"][
                "testResults"
            ]
            test_results = test_results_data["edges"]

            nodes = []
            for edge in test_results:
                node = edge["node"]
                nodes.append(node)

            response_data = {
                "results": nodes,
                "pageInfo": test_results_data.get(
                    "pageInfo",
                    {
                        "endCursor": None,
                        "hasNextPage": False,
                        "startCursor": None,
                        "hasPreviousPage": False,
                    },
                ),
                "totalCount": test_results_data.get("totalCount", len(nodes)),
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "test-results",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise
