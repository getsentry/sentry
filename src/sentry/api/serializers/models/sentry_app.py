from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import SentryApp


@register(SentryApp)
class SentryAppSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'name': obj.name,
            'slug': obj.slug,
            'scopes': obj.get_scopes(),
            'status': obj.get_status_display(),
            'uuid': obj.uuid,
            'webhook_url': obj.webhook_url,
            'redirect_url': obj.redirect_url,
            'clientID': obj.application.client_id,
            'clientSecret': obj.application.client_secret,
            'overview': obj.overview,
        }
