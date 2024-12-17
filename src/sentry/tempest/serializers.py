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
        }
