from datetime import datetime
from typing import Any

from typing_extensions import TypedDict

from sentry.api.serializers import (
    EnvironmentSerializer,
    ProjectSerializerResponse,
    Serializer,
    register,
    serialize,
)
from sentry.models import Project

from .models import Monitor, MonitorCheckIn, MonitorEnvironment


@register(Monitor)
class MonitorSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        # TODO(dcramer): assert on relations
        projects = {
            p["id"]: p
            for p in serialize(
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
        status, lastCheckIn, nextCheckIn = (
            obj.get_status_display(),
            obj.last_checkin,
            obj.next_checkin,
        )
        if hasattr(obj, "selected_monitorenvironment") and obj.selected_monitorenvironment:
            monitor_environment = obj.selected_monitorenvironment[0]
            status, lastCheckIn, nextCheckIn = (
                monitor_environment.get_status_display(),
                monitor_environment.last_checkin,
                monitor_environment.next_checkin,
            )
        return {
            "id": str(obj.guid),
            "status": status,
            "type": obj.get_type_display(),
            "name": obj.name,
            "slug": obj.slug,
            "config": config,
            "lastCheckIn": lastCheckIn,
            "nextCheckIn": nextCheckIn,
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


@register(MonitorEnvironment)
class MonitorEnvironmentSerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer): assert on relations
        projects = {
            d["id"]: d
            for d in serialize(
                list(Project.objects.filter(id__in=[i.monitor.project_id for i in item_list])), user
            )
        }

        return {
            item: {
                "project": projects[str(item.monitor.project_id)]
                if item.monitor.project_id
                else None
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        config = obj.monitor.config.copy()
        if "schedule_type" in config:
            config["schedule_type"] = obj.get_schedule_type_display()
        return {
            "id": str(obj.monitor.guid),
            "status": obj.get_status_display(),
            "type": obj.monitor.get_type_display(),
            "name": obj.monitor.name,
            "slug": obj.monitor.slug,
            "config": config,
            "lastCheckIn": obj.last_checkin,
            "nextCheckIn": obj.next_checkin,
            "dateCreated": obj.monitor.date_added,
            "project": attrs["project"],
            "environment": serialize(obj.environment, EnvironmentSerializer),
        }


class MonitorEnvironmentSerializerResponse(TypedDict):
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
    environment: EnvironmentSerializer


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
