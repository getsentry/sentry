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


class TestResultSerializer(serializers.ListSerializer):
    """
    Serializer for a list of test results - inherits from ListSerializer to handle arrays
    """

    child = TestResultNodeSerializer()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the expected client format
        """
        try:
            # Extract test result nodes from the nested GraphQL structure
            test_results = graphql_response["data"]["owner"]["repository"]["testAnalytics"][
                "testResults"
            ]["edges"]

            # Transform each edge to just the node data
            nodes = []
            for edge in test_results:
                node = edge["node"]
                # Add lastDuration fallback if not present
                if "lastDuration" not in node:
                    node["lastDuration"] = node["avgDuration"]
                nodes.append(node)

            # Use the parent ListSerializer to serialize each test result
            return super().to_representation(nodes)

        except (KeyError, TypeError) as e:
            # Handle malformed GraphQL response
            sentry_sdk.capture_exception(e)
            return []
