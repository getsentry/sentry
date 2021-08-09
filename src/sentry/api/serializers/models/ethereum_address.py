from rest_framework import serializers

from sentry.models import EthereumAddress


class EthereumAddressSerializer(serializers.ModelSerializer):
    abiContents = serializers.CharField(source="abi_contents")
    displayName = serializers.CharField(source="display_name")
    lastUpdated = serializers.DateTimeField(source="last_updated")

    class Meta:
        model = EthereumAddress
        fields = ["id", "address", "abiContents", "displayName", "lastUpdated"]
        read_only_fields = ["id", "lastUpdated"]
