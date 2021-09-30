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
        install = kwargs.get("install")
        event_action = kwargs.get("event_action")
        return {
            "id": f"{event_action.id}",
            "enabled": event_action.is_enabled(),
            "actionType": event_action.actionType,
            "service": obj.sentry_app.slug,
            "sentryAppInstallationUuid": f"{install.uuid}",
            "prompt": f"{obj.sentry_app.name}",
            "label": f"{obj.schema.get('title', obj.sentry_app.name)} with these ",
            "formFields": obj.schema.get("settings", {}),
        }
