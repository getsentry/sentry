from collections.abc import Mapping, MutableMapping, Sequence

from django.contrib.auth.models import AnonymousUser
from rest_framework import serializers

from sentry.api.serializers.base import Serializer, register
from sentry.tempest.models import TempestCredentials
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


@register(TempestCredentials)
class TempestCredentialsSerializer(Serializer):
    def _obfuscate_client_secret(self, client_secret: str) -> str:
        return "*" * len(client_secret)

    def get_attrs(
        self,
        item_list: Sequence[TempestCredentials],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> MutableMapping[TempestCredentials, dict[str, RpcUser | None]]:
        users_mapping = {}
        user_ids = [item.created_by_id for item in item_list if item.created_by_id is not None]
        users = user_service.get_many_by_id(ids=user_ids)
        for rpc_user in users:
            users_mapping[rpc_user.id] = rpc_user

        attrs: MutableMapping[TempestCredentials, dict[str, RpcUser | None]] = {}
        for item in item_list:
            attrs[item] = {
                "user": (
                    users_mapping.get(item.created_by_id)
                    if item.created_by_id is not None
                    else None
                )
            }

        return attrs

    def serialize(
        self,
        obj: TempestCredentials,
        attrs: Mapping[str, RpcUser | None],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> Mapping[str, object]:
        rpc_user = attrs["user"]
        return {
            "id": obj.id,
            "clientId": obj.client_id,
            "clientSecret": self._obfuscate_client_secret(obj.client_secret),
            "message": obj.message,
            "messageType": obj.message_type,
            "latestFetchedItemId": obj.latest_fetched_item_id,
            "createdById": obj.created_by_id,
            "createdByEmail": rpc_user.email if rpc_user else None,
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
        }


class DRFTempestCredentialsSerializer(serializers.ModelSerializer[TempestCredentials]):
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
