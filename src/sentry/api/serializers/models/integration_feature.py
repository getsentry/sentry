from sentry.api.serializers import Serializer, register
from sentry.models import IntegrationFeature


@register(IntegrationFeature)
class IntegrationFeatureSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "description": obj.description.strip(),
            # feature gating work done in getsentry expects the format 'featureGate'
            "featureGate": obj.feature_str(),
        }
