from sentry.api.serializers import Serializer, register
from sentry.models import IntegrationFeature
from sentry.models.user import User


@register(IntegrationFeature)
class IntegrationFeatureSerializer(Serializer):
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
            data.update({"description": obj.description.strip()})
        return data
