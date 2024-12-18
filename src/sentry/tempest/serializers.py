from rest_framework import serializers

from sentry.api.serializers.base import Serializer, register
from sentry.tempest.models import TempestCredentials


@register(TempestCredentials)
class TempestCredentialsSerializer(Serializer):
    def _obfuscate_client_secret(self, client_secret: str) -> str:
        return "*" * len(client_secret)

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": obj.id,
            "clientId": obj.client_id,
            "clientSecret": self._obfuscate_client_secret(obj.client_secret),
            "message": obj.message,
            "messageType": obj.message_type,
            "latestFetchedItemId": obj.latest_fetched_item_id,
            "createdById": obj.created_by_id,
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
        }


class DRFTempestCredentialsSerializer(serializers.ModelSerializer):
    clientId = serializers.CharField(source="client_id")
    clientSecret = serializers.CharField(source="client_secret")
    message = serializers.CharField(read_only=True)
    messageType = serializers.CharField(source="message_type", read_only=True)
    latestFetchedItemId = serializers.CharField(source="latest_fetched_item_id", read_only=True)
    createdById = serializers.CharField(source="created_by_id", read_only=True)
    dateAdded = serializers.DateTimeField(source="date_added", read_only=True)
    dateUpdated = serializers.DateTimeField(source="date_updated", read_only=True)

    class Meta:
        model = TempestCredentials
        fields = [
            "id",
            "clientId",
            "clientSecret",
            "message",
            "messageType",
            "latestFetchedItemId",
            "createdById",
            "dateAdded",
            "dateUpdated",
        ]
