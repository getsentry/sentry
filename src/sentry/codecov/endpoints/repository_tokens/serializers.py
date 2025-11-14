from typing import int
import logging

import sentry_sdk
from rest_framework import serializers

from sentry.codecov.endpoints.common.serializers import PageInfoSerializer

logger = logging.getLogger(__name__)


class RepositoryTokenNodeSerializer(serializers.Serializer):
    """
    Serializer for individual repository nodes from GraphQL response
    """

    name = serializers.CharField()
    token = serializers.CharField()


class RepositoryTokensSerializer(serializers.Serializer):
    """
    Serializer for repository tokens response
    """

    results = RepositoryTokenNodeSerializer(many=True)
    pageInfo = PageInfoSerializer()
    totalCount = serializers.IntegerField()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            repository_tokens_data = graphql_response["data"]["owner"]["repositories"]
            repository_tokens = repository_tokens_data["edges"]
            page_info = repository_tokens_data.get("pageInfo", {})

            nodes = []
            for edge in repository_tokens:
                node = edge["node"]
                nodes.append(node)

            response_data = {
                "results": nodes,
                "pageInfo": repository_tokens_data.get(
                    "pageInfo",
                    {
                        "hasNextPage": page_info.get("hasNextPage", False),
                        "hasPreviousPage": page_info.get("hasPreviousPage", False),
                        "startCursor": page_info.get("startCursor"),
                        "endCursor": page_info.get("endCursor"),
                    },
                ),
                "totalCount": repository_tokens_data.get("totalCount", len(nodes)),
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "repository-tokens",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise
