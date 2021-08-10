from rest_framework import serializers

from sentry.models import EthereumAddress


class EthereumAddressSerializer(serializers.Serializer):
    abiContents = serializers.CharField(required=False, default="")
    address = serializers.CharField(max_length=40)
    displayName = serializers.CharField(required=False, default="")

    class Meta:
        model = EthereumAddress
        fields = ["abiContents", "address", "displayName"]
