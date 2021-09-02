from sentry.api.serializers import Serializer, register
from sentry.models import SentryAppComponent


@register(SentryAppComponent)
class SentryAppComponentSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "uuid": str(obj.uuid),
            "type": obj.type,
            "schema": obj.schema,
            "sentryApp": {
                "uuid": obj.sentry_app.uuid,
                "slug": obj.sentry_app.slug,
                "name": obj.sentry_app.name,
            },
        }


class SentryAppAlertRuleActionSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": f"sentry.sentryapp.{obj.sentry_app.slug}",
            "uuid": str(obj.uuid),
            "actionType": "sentryapp",
            "prompt": f"{obj.sentry_app.name}",
            "enabled": True,
            "label": f"{obj.schema.get('title', obj.sentry_app.name)} with these ",
            "formfields": obj.schema.get("settings", {}),
        }
