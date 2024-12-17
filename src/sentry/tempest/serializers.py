from sentry.api.serializers.base import Serializer


class TempestCredentialsSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": obj.id,
            "clientId": obj.client_id,
            "clientSecret": obj.client_secret,
            "message": obj.message,
            "messageType": obj.message_type,
            "latestFetchedItemId": obj.latest_fetched_item_id,
            "createdById": obj.created_by_id,
        }
