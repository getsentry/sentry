from drf_spectacular.openapi import AutoSchema
from rest_framework import serializers


class DummySerializer(serializers.Serializer):

    dummy = serializers.CharField(help_text="This is a dummy param to test schemas", required=False)


class SentryDocSchema(AutoSchema):
    def get_override_parameters(self):
        """
        we need to extract
        """
        return [DummySerializer]
