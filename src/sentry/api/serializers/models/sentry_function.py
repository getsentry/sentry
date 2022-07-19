from sentry.api.serializers import Serializer, register
from sentry.models.sentryfunction import SentryFunction


@register(SentryFunction)
class SentryFunctionSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        data = {
            "name": obj.name,
            "slug": obj.slug,
            "author": obj.author,
            "external_id": obj.external_id,
        }
        return data
