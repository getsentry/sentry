from datetime import datetime
from typing import Any

from typing_extensions import TypedDict

from sentry.api.serializers import ProjectSerializerResponse, Serializer, register, serialize
from sentry.models import Project

from .models import Monitor, MonitorCheckIn, MonitorEnvironment


@register(MonitorEnvironment)
class MonitorEnvironmentSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "monitor_id": obj.monitor.id,
            "status": obj.get_status_display(),
            "name": obj.environment.name,
            "lastCheckIn": obj.last_checkin,
            "nextCheckIn": obj.next_checkin,
            "dateCreated": obj.monitor.date_added,
        }


class MonitorEnvironmentSerializerResponse(TypedDict):
    monitor_id: str
    name: str
    status: str
    dateCreated: datetime
    lastCheckIn: datetime
    nextCheckIn: datetime


@register(Monitor)
class MonitorSerializer(Serializer):
    def __init__(self, environments=None):
        self.environments = environments

    def get_attrs(self, item_list, user, **kwargs):
        # TODO(dcramer): assert on relations
        projects = {
            p["id"]: p
            for p in serialize(
                list(Project.objects.filter(id__in=[i.project_id for i in item_list])), user
            )
        }

        environment_data = {}
        if self.environments:
            monitor_environments = {
                monitor_environment.pop("monitor_id"): {
                    monitor_environment.pop("name"): monitor_environment
                }
                for monitor_environment in serialize(
                    list(
                        MonitorEnvironment.objects.filter(
                            monitor__in=item_list, environment__in=self.environments
                        ).select_related("environment")
                    ),
                    user,
                )
            }

            environment_data = {str(item.id): monitor_environments[item.id] for item in item_list}

        return {
            item: {
                "project": projects[str(item.project_id)] if item.project_id else None,
                "environments": environment_data[str(item.id)] if self.environments else None,
            }
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
            "environments": attrs["environments"],
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
    environments: MonitorEnvironmentSerializerResponse


@register(MonitorCheckIn)
class MonitorCheckInSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.guid),
            "environment": obj.monitor_environment.environment.name
            if obj.monitor_environment
            else None,
            "status": obj.get_status_display(),
            "duration": obj.duration,
            "dateCreated": obj.date_added,
            "attachmentId": obj.attachment_id,
        }


class MonitorCheckInSerializerResponse(TypedDict):
    id: str
    environment: str
    status: str
    duration: int
    dateCreated: datetime
    attachmentId: str
