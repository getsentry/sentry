from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class ServiceHookSerializerResponse(TypedDict):
    id: str | None
    url: str
    status: str
    events: list[str]
    dateCreated: datetime


class ServiceHookCreationSerializerResponse(ServiceHookSerializerResponse):
    secret: Annotated[
        str,
        ApiDescription(
            "The webhook signing secret. Only returned when the hook is created; "
            "store it securely to verify webhook signatures."
        ),
    ]


@register(ServiceHook)
class ServiceHookSerializer(Serializer[ServiceHookSerializerResponse]):
    def serialize(
        self,
        obj: ServiceHook,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> ServiceHookSerializerResponse:
        return {
            "id": obj.guid,
            "url": obj.url,
            "status": obj.get_status_display(),
            "events": sorted(obj.events),
            "dateCreated": obj.date_added,
        }
