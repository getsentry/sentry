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
        event_action = kwargs.get("event_action")
        if not event_action:
            raise AssertionError("Requires event_action keyword argument of type EventAction")

        install = kwargs.get("install")
        if not install:
            raise AssertionError("Requires install keyword argument of type SentryAppInstallation")

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
