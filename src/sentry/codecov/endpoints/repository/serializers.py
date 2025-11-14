from typing import int
import logging

import sentry_sdk
from rest_framework import serializers

logger = logging.getLogger(__name__)


class RepositorySerializer(serializers.Serializer):
    """
    Serializer for single repository response
    """

    uploadToken = serializers.CharField(allow_null=True)
    testAnalyticsEnabled = serializers.BooleanField()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            repository_data = graphql_response["data"]["owner"]["repository"]
            return super().to_representation(repository_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "repository",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise
