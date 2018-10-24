from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from sentry.api.serializers import Serializer, register
from sentry.models import SentryApp


@register(SentryApp)
class SentryAppSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        has_secret = obj.date_added > timezone.now() - timedelta(days=1)
        return {
            'name': obj.name,
            'scopes': obj.get_scopes(),
            'uuid': obj.uuid,
            'webhook_url': obj.webhook_url,
            'clientID': obj.client_id,
            'clientSecret': obj.client_secret if has_secret else None,
        }
