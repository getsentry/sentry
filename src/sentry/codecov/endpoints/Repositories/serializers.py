import logging

import sentry_sdk
from rest_framework import serializers

logger = logging.getLogger(__name__)


class RepositoryNodeSerializer(serializers.Serializer):
    """
    Serializer for individual repository nodes from GraphQL response
    """

    __test__ = False

    name = serializers.CharField()
    updatedAt = serializers.DateTimeField()
    latestCommitAt = serializers.DateTimeField()
    defaultBranch = serializers.CharField()


class RepositoriesSerializer(serializers.Serializer):
    """
    Serializer for repositories response
    """

    __test__ = False

    results = RepositoryNodeSerializer(many=True)

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            repository_data = graphql_response["data"]["owner"]["repositories"]
            repositories = repository_data["edges"]

            nodes = []
            for edge in repositories:
                node = edge["node"]
                nodes.append(node)

            response_data = {
                "results": nodes,
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "repositories",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise
