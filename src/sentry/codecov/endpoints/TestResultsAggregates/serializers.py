import logging

import sentry_sdk
from rest_framework import serializers

logger = logging.getLogger(__name__)


class TestResultAggregatesSerializer(serializers.Serializer):
    """
    Serializer for test results aggregates response
    """

    totalDuration = serializers.IntegerField()
    totalDurationPercentChange = serializers.IntegerField()
    slowestTestsDuration = serializers.IntegerField()
    slowestTestsDurationPercentChange = serializers.IntegerField()
    totalSlowTests = serializers.IntegerField()
    totalSlowTestsPercentChange = serializers.IntegerField()
    totalFails = serializers.IntegerField()
    totalFailsPercentChange = serializers.IntegerField()
    totalSkips = serializers.IntegerField()
    totalSkipsPercentChange = serializers.IntegerField()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            response_data = graphql_response["data"]["owner"]["repository"]["testAnalytics"][
                "testResultsAggregates"
            ]

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "test-results-aggregates",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise
