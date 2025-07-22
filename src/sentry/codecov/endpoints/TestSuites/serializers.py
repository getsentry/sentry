import logging

import sentry_sdk
from rest_framework import serializers

logger = logging.getLogger(__name__)


class TestSuiteSerializer(serializers.Serializer):
    """
    Serializer for test suites belonging to a repository's test results
    """

    __test__ = False

    defaultBranch = serializers.CharField()
    testSuites = serializers.ListField(child=serializers.CharField())

    def to_representation(self, instance):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            repository_data = instance["data"]["owner"]["repository"]
            response_data = {
                "testSuites": repository_data["testAnalytics"]["testSuites"],
                "defaultBranch": repository_data["defaultBranch"],
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "test-suites",
                    "response_keys": (
                        list(instance.keys()) if isinstance(instance, dict) else None
                    ),
                },
            )
            raise
