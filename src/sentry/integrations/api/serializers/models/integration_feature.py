from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.integrations.models.integration_feature import IntegrationFeature
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


@register(IntegrationFeature)
class IntegrationFeatureSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[IntegrationFeature],
        user: User | RpcUser | AnonymousUser,
        has_target: bool = True,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
        # Perform DB calls for description field in bulk
        description_attrs = (
            IntegrationFeature.objects.get_descriptions_as_dict(list(item_list))
            if has_target
            else {}
        )
        return {item: {"description": description_attrs.get(item.id)} for item in item_list}

    def serialize(
        self,
        obj: IntegrationFeature,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        has_target: bool = True,
        **kwargs,
    ):
        data = {
            "featureId": obj.feature,
            # feature gating work done in getsentry expects the format 'featureGate'
            "featureGate": obj.feature_str(),
        }
        if has_target:
            # These properties require a target on the IntegrationFeature.
            # If no target is provided, the serialized IntegrationFeature payload will be generic,
            # and not only applicable to one target.
            data.update({"description": attrs.get("description")})
        return data
