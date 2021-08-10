from rest_framework import serializers

from sentry.models import EthereumAddress


class EthereumAddressSerializer(serializers.Serializer):
    abiContents = serializers.CharField(required=False, allow_blank=True, default="")
    address = serializers.CharField(max_length=40)
    displayName = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = EthereumAddress
        fields = ["abiContents", "address", "displayName"]
