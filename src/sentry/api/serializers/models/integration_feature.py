from typing import Any, List, MutableMapping

from sentry.api.serializers import Serializer, register
from sentry.models.integrations.integration_feature import IntegrationFeature
from sentry.models.user import User


@register(IntegrationFeature)
class IntegrationFeatureSerializer(Serializer):
    def get_attrs(
        self,
        item_list: List[IntegrationFeature],
        user: User,
        has_target: bool = True,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
        # Perform DB calls for description field in bulk
        description_attrs = (
            IntegrationFeature.objects.get_descriptions_as_dict(item_list) if has_target else {}
        )
        return {item: {"description": description_attrs.get(item.id)} for item in item_list}

    def serialize(self, obj: IntegrationFeature, attrs, user: User, has_target: bool = True):
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
