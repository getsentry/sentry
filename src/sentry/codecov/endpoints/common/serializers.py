from rest_framework import serializers


class PageInfoTempSerializer(serializers.Serializer):
    """
    Serializer for pagination information
    """

    startCursor = serializers.CharField(allow_null=True)
    endCursor = serializers.CharField(allow_null=True)
    hasNextPage = serializers.BooleanField()
    hasPreviousPage = serializers.BooleanField()
