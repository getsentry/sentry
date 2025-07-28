import logging

import sentry_sdk
from rest_framework import serializers

logger = logging.getLogger(__name__)


class TestResultAggregatesSerializer(serializers.Serializer):
    """
    Serializer for test results aggregates response
    """

    __test__ = False

    totalDuration = serializers.FloatField()
    totalDurationPercentChange = serializers.FloatField()
    slowestTestsDuration = serializers.FloatField()
    slowestTestsDurationPercentChange = serializers.FloatField()
    totalSlowTests = serializers.IntegerField()
    totalSlowTestsPercentChange = serializers.FloatField()
    totalFails = serializers.IntegerField()
    totalFailsPercentChange = serializers.FloatField()
    totalSkips = serializers.IntegerField()
    totalSkipsPercentChange = serializers.FloatField()
    flakeCount = serializers.IntegerField()
    flakeCountPercentChange = serializers.FloatField()
    flakeRate = serializers.FloatField()
    flakeRatePercentChange = serializers.FloatField()

    def to_representation(self, instance):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            test_analytics = instance["data"]["owner"]["repository"]["testAnalytics"]
            response_data = test_analytics["testResultsAggregates"]
            response_data.update(test_analytics["flakeAggregates"])

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "test-results-aggregates",
                    "response_keys": (
                        list(instance.keys()) if isinstance(instance, dict) else None
                    ),
                },
            )
            raise
