from __future__ import annotations

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.base import serialize
from sentry.models.integrations.sentry_app_component import SentryAppComponent
from sentry.services.hybrid_cloud.app import SentryAppEventDataInterface


@register(SentryAppComponent)
class SentryAppComponentSerializer(Serializer):
    def serialize(self, obj, attrs, user, errors):
        return {
            "uuid": str(obj.uuid),
            "type": obj.type,
            "schema": obj.schema,
            "error": True if str(obj.uuid) in errors else False,
            "sentryApp": {
                "uuid": obj.sentry_app.uuid,
                "slug": obj.sentry_app.slug,
                "name": obj.sentry_app.name,
                "avatars": [serialize(avatar) for avatar in obj.sentry_app.avatar.all()],
            },
        }


class SentryAppAlertRuleActionSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        event_action: SentryAppEventDataInterface | None = kwargs.get("event_action")
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
