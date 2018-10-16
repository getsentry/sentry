from __future__ import absolute_import


from sentry.api.serializers import Serializer, register
from sentry.models import SentryApp


@register(SentryApp)
class SentryAppSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'name': obj.name,
            'scopes': obj.get_scopes(),
            'uuid': obj.uuid,
            'webhook_url': obj.webhook_url,
        }
