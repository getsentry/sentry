from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import IntegrationFeature


@register(IntegrationFeature)
class ServiceHookSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'description': obj.description['data'].strip(),
            'featureGate': obj.feature_str(),
        }
