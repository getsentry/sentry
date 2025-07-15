import logging

import sentry_sdk
from rest_framework import serializers

from sentry.codecov.endpoints.common.serializers import PageInfoTempSerializer

logger = logging.getLogger(__name__)


class BranchNodeSerializer(serializers.Serializer):
    """
    Serializer for individual branch nodes from GraphQL response
    """

    __test__ = False

    name = serializers.CharField()


class BranchesSerializer(serializers.Serializer):
    """
    Serializer for repositories response
    """

    __test__ = False

    results = BranchNodeSerializer(many=True)
    pageInfo = PageInfoTempSerializer()
    totalCount = serializers.IntegerField()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            branch_data = graphql_response["data"]["owner"]["repository"]["branches"]
            branches = branch_data["edges"]
            page_info = branch_data.get("pageInfo", {})

            nodes = []
            for edge in branches:
                node = edge["node"]
                nodes.append(node)

            response_data = {
                "results": nodes,
                "pageInfo": branch_data.get(
                    "pageInfo",
                    {
                        "hasNextPage": page_info.get("hasNextPage", False),
                        "hasPreviousPage": page_info.get("hasPreviousPage", False),
                        "startCursor": page_info.get("startCursor"),
                        "endCursor": page_info.get("endCursor"),
                    },
                ),
                "totalCount": branch_data.get("totalCount", len(nodes)),
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "branches",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise
