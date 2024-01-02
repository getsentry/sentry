from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List

from django.db.models import prefetch_related_objects
from typing_extensions import TypedDict

from sentry.api.serializers import ProjectSerializerResponse, Serializer, register, serialize
from sentry.models.project import Project
from sentry.monitors.utils import fetch_associated_groups

from .models import Monitor, MonitorCheckIn, MonitorEnvironment, MonitorStatus


class MonitorEnvironmentSerializerResponse(TypedDict):
    name: str
    status: str
    isMuted: bool
    dateCreated: datetime
    lastCheckIn: datetime
    nextCheckIn: datetime
    nextCheckInLatest: datetime


@register(MonitorEnvironment)
class MonitorEnvironmentSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> MonitorEnvironmentSerializerResponse:
        return {
            "name": obj.environment.name,
            "status": obj.get_status_display(),
            "isMuted": obj.is_muted,
            "dateCreated": obj.monitor.date_added,
            "lastCheckIn": obj.last_checkin,
            "nextCheckIn": obj.next_checkin,
            "nextCheckInLatest": obj.next_checkin_latest,
        }


class MonitorSerializerResponseOptional(TypedDict, total=False):
    alertRule: Any  # TODO: Find out what type this is


class MonitorSerializerResponse(MonitorSerializerResponseOptional):
    id: str
    name: str
    slug: str
    status: str
    isMuted: bool
    type: str
    config: Any
    dateCreated: datetime
    project: ProjectSerializerResponse
    environments: MonitorEnvironmentSerializerResponse


@register(Monitor)
class MonitorSerializer(Serializer):
    def __init__(self, environments=None, expand=None):
        self.environments = environments
        self.expand = expand

    def get_attrs(self, item_list, user, **kwargs):
        # TODO(dcramer): assert on relations
        projects = {
            p["id"]: p
            for p in serialize(
                list(Project.objects.filter(id__in=[i.project_id for i in item_list])), user
            )
        }

        serialized_monitor_environments = defaultdict(list)
        monitor_environments = (
            MonitorEnvironment.objects.filter(monitor__in=item_list)
            .select_related("environment")
            .order_by("-last_checkin")
            .exclude(
                status__in=[MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS]
            )
        )
        if self.environments:
            monitor_environments = monitor_environments.filter(environment__in=self.environments)

        for monitor_environment in monitor_environments:
            # individually serialize as related objects are prefetched
            serialized_monitor_environments[monitor_environment.monitor_id].append(
                serialize(
                    monitor_environment,
                    user,
                )
            )

        environment_data = {
            str(item.id): serialized_monitor_environments.get(item.id, []) for item in item_list
        }

        attrs = {
            item: {
                "project": projects[str(item.project_id)] if item.project_id else None,
                "environments": environment_data[str(item.id)],
            }
            for item in item_list
        }

        if self._expand("alertRule"):
            for item in item_list:
                attrs[item]["alertRule"] = item.get_alert_rule_data()

        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> MonitorSerializerResponse:
        config = obj.config.copy()
        if "schedule_type" in config:
            config["schedule_type"] = obj.get_schedule_type_display()

        result: MonitorSerializerResponse = {
            "id": str(obj.guid),
            "status": obj.get_status_display(),
            "isMuted": obj.is_muted,
            "type": obj.get_type_display(),
            "name": obj.name,
            "slug": obj.slug,
            "config": config,
            "dateCreated": obj.date_added,
            "project": attrs["project"],
            "environments": attrs["environments"],
        }

        if self._expand("alertRule"):
            result["alertRule"] = attrs["alertRule"]

        return result

    def _expand(self, key) -> bool:
        if self.expand is None:
            return False

        return key in self.expand


class MonitorCheckInSerializerResponseOptional(TypedDict, total=False):
    groups: List[str]


class MonitorCheckInSerializerResponse(MonitorCheckInSerializerResponseOptional):
    id: str
    environment: str
    status: str
    duration: int
    dateCreated: datetime
    attachmentId: str
    expectedTime: datetime
    monitorConfig: Any


@register(MonitorCheckIn)
class MonitorCheckInSerializer(Serializer):
    def __init__(self, start=None, end=None, expand=None, organization_id=None, project_id=None):
        self.start = start  # timestamp of the beginning of the specified date range
        self.end = end  # timestamp of the end of the specified date range
        self.expand = expand
        self.organization_id = organization_id
        self.project_id = project_id

    def get_attrs(self, item_list, user, **kwargs):
        # prefetch monitor environment data
        prefetch_related_objects(item_list, "monitor_environment__environment")

        attrs = {}
        if self._expand("groups") and self.start and self.end:
            # aggregate all the trace_ids in the given set of check-ins
            trace_ids = []
            trace_groups: Dict[str, List[Dict[str, int]]] = defaultdict(list)

            for item in item_list:
                if item.trace_id:
                    trace_ids.append(item.trace_id.hex)

            if trace_ids:
                trace_groups = fetch_associated_groups(
                    trace_ids, self.organization_id, self.project_id, self.start, self.end
                )

            attrs = {
                item: {
                    "groups": trace_groups.get(item.trace_id.hex, []) if item.trace_id else [],
                }
                for item in item_list
            }

        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> MonitorCheckInSerializerResponse:
        result: MonitorCheckInSerializerResponse = {
            "id": str(obj.guid),
            "environment": obj.monitor_environment.environment.name
            if obj.monitor_environment
            else None,
            "status": obj.get_status_display(),
            "duration": obj.duration,
            "dateCreated": obj.date_added,
            "attachmentId": obj.attachment_id,
            "expectedTime": obj.expected_time,
            "monitorConfig": obj.monitor_config or {},
        }

        if self._expand("groups"):
            result["groups"] = attrs.get("groups", [])

        return result

    def _expand(self, key) -> bool:
        if self.expand is None:
            return False

        return key in self.expand
