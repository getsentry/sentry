from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import SentryAppWebhookError


@register(SentryAppWebhookError)
class SentryAppWebhookErrorSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        data = {
            "app": {
                "uuid": obj.sentry_app.uuid,
                "slug": obj.sentry_app.slug,
                "name": obj.sentry_app.name,
            },
            "date": obj.date_added,
            "organization": {"slug": obj.organization.slug, "name": obj.organization.name},
            "errorId": obj.error_id,
            "request": {"body": obj.request_body, "headers": obj.request_headers},
            "eventType": obj.event_type,
            "webhookUrl": obj.webhook_url,
            "response": {"body": obj.response_body, "statusCode": obj.response_code},
        }

        return data
