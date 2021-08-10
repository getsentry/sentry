from rest_framework import serializers

from sentry.models import EthereumAddress


class EthereumAddressSerializer(serializers.Serializer):
    abiContents = serializers.JSONField(source="abi_contents", required=False)
    displayName = serializers.CharField(source="display_name", required=False)

    class Meta:
        model = EthereumAddress
        fields = ["abiContents", "displayName"]
