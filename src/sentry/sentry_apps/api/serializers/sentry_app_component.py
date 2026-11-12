from __future__ import annotations

from collections.abc import Mapping
from typing import Annotated, Any, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.base import serialize
from sentry.apidocs.descriptions import ApiDescription, ApiSchema
from sentry.apidocs.formats import Uuid, uuid_str
from sentry.sentry_apps.api.serializers.response_schemas import component_schema
from sentry.sentry_apps.api.serializers.sentry_app_avatar import SentryAppAvatarSerializerResponse
from sentry.sentry_apps.generated_schema_types import SentryAppComponentSchema
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.services.app import SentryAppEventDataInterface
from sentry.sentry_apps.utils.errors import SentryAppPublicErrorBody
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class SentryAppComponentAppResponse(TypedDict):
    uuid: Annotated[Uuid, ApiDescription("UUID of the custom integration")]
    slug: Annotated[str, ApiDescription("Slug of the custom integration")]
    name: Annotated[str, ApiDescription("Name of the custom integration")]
    avatars: Annotated[
        list[SentryAppAvatarSerializerResponse], ApiDescription("Avatars of the custom integration")
    ]


class SentryAppComponentSerializerResponse(TypedDict):
    uuid: Annotated[Uuid, ApiDescription("UUID of the component")]
    type: Annotated[
        str,
        ApiDescription(
            "Type of the component, such as issue-link, stacktrace-link or alert-rule-action"
        ),
    ]
    schema: Annotated[
        SentryAppComponentSchema,
        ApiDescription("UI schema of the component"),
        ApiSchema(component_schema),
    ]
    error: Annotated[
        str | SentryAppPublicErrorBody,
        ApiDescription("Error from loading the component. Empty when there's none"),
    ]
    sentryApp: Annotated[
        SentryAppComponentAppResponse,
        ApiDescription("Custom integration that provides the component"),
    ]
    installationUuid: NotRequired[
        Annotated[
            Uuid, ApiDescription("UUID of the integration installation the component belongs to")
        ]
    ]


@register(SentryAppComponent)
class SentryAppComponentSerializer(Serializer[SentryAppComponentSerializerResponse]):
    def serialize(
        self,
        obj: SentryAppComponent,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> SentryAppComponentSerializerResponse:
        errors = kwargs["errors"]
        installation_uuids: dict[int, str] | None = kwargs.get("installation_uuids")
        data: SentryAppComponentSerializerResponse = {
            "uuid": uuid_str(obj.uuid),
            "type": obj.type,
            "schema": obj.schema,
            "error": errors.get(str(obj.uuid), ""),
            "sentryApp": {
                "uuid": uuid_str(obj.sentry_app.uuid),
                "slug": obj.sentry_app.slug,
                "name": obj.sentry_app.name,
                "avatars": [serialize(avatar) for avatar in obj.sentry_app.avatar.all()],
            },
        }
        if installation_uuids is not None:
            data["installationUuid"] = uuid_str(installation_uuids[obj.sentry_app_id])
        return data


class SentryAppAlertRuleActionSerializer(Serializer):
    def serialize(
        self,
        obj: SentryAppComponent,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[str, object]:
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
