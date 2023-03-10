from datetime import datetime
from typing import Any

from typing_extensions import TypedDict

from sentry.api.serializers import ProjectSerializerResponse, Serializer, register, serialize
from sentry.models import Project

from .models import Monitor, MonitorCheckIn


@register(Monitor)
class MonitorSerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer): assert on relations
        projects = {
            d["id"]: d
            for d in serialize(
                list(Project.objects.filter(id__in=[i.project_id for i in item_list])), user
            )
        }

        return {
            item: {"project": projects[str(item.project_id)] if item.project_id else None}
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        config = obj.config.copy()
        if "schedule_type" in config:
            config["schedule_type"] = obj.get_schedule_type_display()
        return {
            "id": str(obj.guid),
            "status": obj.get_status_display(),
            "type": obj.get_type_display(),
            "name": obj.name,
            "slug": obj.slug,
            "config": config,
            "lastCheckIn": obj.last_checkin,
            "nextCheckIn": obj.next_checkin,
            "dateCreated": obj.date_added,
            "project": attrs["project"],
        }


class MonitorSerializerResponse(TypedDict):
    id: str
    name: str
    slug: str
    status: str
    type: str
    config: Any
    dateCreated: datetime
    lastCheckIn: datetime
    nextCheckIn: datetime
    project: ProjectSerializerResponse


@register(MonitorCheckIn)
class MonitorCheckInSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.guid),
            "status": obj.get_status_display(),
            "duration": obj.duration,
            "dateCreated": obj.date_added,
            "attachmentId": obj.attachment_id,
        }


class MonitorCheckInSerializerResponse(TypedDict):
    id: str
    status: str
    duration: int
    dateCreated: datetime
    attachmentId: str
