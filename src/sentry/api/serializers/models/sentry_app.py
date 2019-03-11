from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import SentryApp


@register(SentryApp)
class SentryAppSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        from sentry.mediators.service_hooks.creator import consolidate_events
        return {
            'name': obj.name,
            'slug': obj.slug,
            'scopes': obj.get_scopes(),
            'events': consolidate_events(obj.events),
            'status': obj.get_status_display(),
            'schema': obj.schema,
            'uuid': obj.uuid,
            'webhookUrl': obj.webhook_url,
            'redirectUrl': obj.redirect_url,
            'isAlertable': obj.is_alertable,
            'clientId': obj.application.client_id,
            'clientSecret': obj.application.client_secret,
            'overview': obj.overview,
        }
