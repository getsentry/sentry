from rest_framework import serializers


class PageInfoSerializer(serializers.Serializer):
    """
    Serializer for pagination information
    """

    endCursor = serializers.CharField(allow_null=True)
    startCursor = serializers.CharField(allow_null=True)
    hasPreviousPage = serializers.BooleanField()
    hasNextPage = serializers.BooleanField()
