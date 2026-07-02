from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.servicehook import ServiceHook


class ServiceHookSerializerResponse(TypedDict):
    id: str
    url: str
    secret: str
    status: str
    events: list[str]
    dateCreated: datetime


@register(ServiceHook)
class ServiceHookSerializer(Serializer[ServiceHookSerializerResponse]):
    def serialize(self, obj, attrs, user, **kwargs) -> ServiceHookSerializerResponse:
        return {
            "id": obj.guid,
            "url": obj.url,
            "secret": obj.secret,
            "status": obj.get_status_display(),
            "events": sorted(obj.events),
            "dateCreated": obj.date_added,
        }
