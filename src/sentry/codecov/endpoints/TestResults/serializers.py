import sentry_sdk
from rest_framework import serializers


class TestResultNodeSerializer(serializers.Serializer):
    """
    Serializer for individual test result nodes from GraphQL response
    """

    updatedAt = serializers.CharField()
    avgDuration = serializers.FloatField()
    name = serializers.CharField()
    failureRate = serializers.FloatField()
    flakeRate = serializers.FloatField()
    commitsFailed = serializers.IntegerField()
    totalFailCount = serializers.IntegerField()
    totalFlakyFailCount = serializers.IntegerField()
    totalSkipCount = serializers.IntegerField()
    totalPassCount = serializers.IntegerField()
    lastDuration = serializers.FloatField()


class PageInfoSerializer(serializers.Serializer):
    """
    Serializer for pagination information
    """

    endCursor = serializers.CharField(allow_null=True)
    hasNextPage = serializers.BooleanField()


class TestResultSerializer(serializers.Serializer):
    """
    Serializer for test results response including pagination metadata
    """

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
                if "lastDuration" not in node:
                    node["lastDuration"] = node["avgDuration"]
                nodes.append(node)

            response_data = {
                "results": nodes,
                "pageInfo": test_results_data.get(
                    "pageInfo", {"endCursor": None, "hasNextPage": False}
                ),
                "totalCount": test_results_data.get("totalCount", len(nodes)),
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            return {
                "results": [],
                "pageInfo": {"endCursor": None, "hasNextPage": False},
                "totalCount": 0,
            }
