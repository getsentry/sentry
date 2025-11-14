from typing import int
import logging

import sentry_sdk
from rest_framework import serializers

logger = logging.getLogger(__name__)


class RepositoryTokenRegenerateSerializer(serializers.Serializer):
    """
    Serializer for repositories response
    """

    token = serializers.CharField()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            data = graphql_response["data"]["regenerateRepositoryUploadToken"]

            if data.get("error"):
                raise serializers.ValidationError(data["error"]["message"])

            response_data = {
                "token": data["token"],
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "repository-token-regenerate",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise
