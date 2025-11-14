from typing import int
import logging

import sentry_sdk
from rest_framework import serializers

logger = logging.getLogger(__name__)


class SyncReposSerializer(serializers.Serializer):
    """
    Serializer for a sync repository response
    """

    isSyncing = serializers.BooleanField()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            http_method = self.context.get("http_method") or "UNKNOWN"

            if http_method == "POST":
                data = graphql_response["data"]["syncRepos"]
            else:
                data = graphql_response["data"]["me"]

            response_data = {
                "isSyncing": data["isSyncing"],
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "sync-repos",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise
