from sentry.api.serializers import Serializer, register
from sentry.models import EthereumAddress


@register(EthereumAddress)
class EthereumAddressSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "address": obj.address,
            "abi_contents": obj.abi_contents,
            "displayName": obj.display_name,
            "lastUpdated": obj.last_updated,
        }
