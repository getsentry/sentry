from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, List

from django.db.models import prefetch_related_objects
from typing_extensions import TypedDict

from sentry.api.serializers import ProjectSerializerResponse, Serializer, register, serialize
from sentry.models import Project

from .models import Monitor, MonitorCheckIn, MonitorEnvironment, MonitorStatus


@register(MonitorEnvironment)
class MonitorEnvironmentSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "name": obj.environment.name,
            "status": obj.get_status_display(),
            "lastCheckIn": obj.last_checkin,
            "nextCheckIn": obj.next_checkin,
            "dateCreated": obj.monitor.date_added,
        }


class MonitorEnvironmentSerializerResponse(TypedDict):
    name: str
    status: str
    dateCreated: datetime
    lastCheckIn: datetime
    nextCheckIn: datetime


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

    def serialize(self, obj, attrs, user):
        config = obj.config.copy()
        if "schedule_type" in config:
            config["schedule_type"] = obj.get_schedule_type_display()

        result = {
            "id": str(obj.guid),
            "status": obj.get_status_display(),
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


class MonitorSerializerResponse(TypedDict):
    id: str
    name: str
    slug: str
    status: str
    type: str
    config: Any
    dateCreated: datetime
    project: ProjectSerializerResponse
    environments: MonitorEnvironmentSerializerResponse


@register(MonitorCheckIn)
class MonitorCheckInSerializer(Serializer):
    def __init__(self, start=None, end=None, expand=None):
        self.start = start
        self.end = end
        self.expand = expand

    def get_attrs(self, item_list, user, **kwargs):
        # prefetch monitor environment data
        prefetch_related_objects(item_list, "monitor_environment__environment")

        attrs = {}
        if self._expand("group_ids") and self.start and self.end:
            from snuba_sdk import (
                Column,
                Condition,
                Direction,
                Entity,
                Limit,
                Offset,
                Op,
                OrderBy,
                Query,
                Request,
            )

            from sentry.eventstore.base import EventStorage
            from sentry.snuba.events import Columns
            from sentry.utils import snuba
            from sentry.utils.snuba import DATASETS, raw_snql_query

            dataset = snuba.Dataset.Events

            query_start = self.start - timedelta(hours=1)
            query_end = self.end + timedelta(hours=1)

            cols = [col.value.event_name for col in EventStorage.minimal_columns[dataset]]
            cols.append(Columns.TRACE_ID.value.event_name)

            trace_ids = []
            for item in item_list:
                if item.trace_id:
                    trace_ids.append(item.trace_id.hex)

            # query snuba for related errors and their associated issues
            snql_request = Request(
                dataset=dataset.value,
                app_id="eventstore",
                query=Query(
                    match=Entity(dataset.value),
                    select=[Column(col) for col in cols],
                    where=[
                        Condition(
                            Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                            Op.GTE,
                            query_start,
                        ),
                        Condition(
                            Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                            Op.LT,
                            query_end,
                        ),
                        Condition(Column("trace_id"), Op.IN, trace_ids),
                        Condition(Column("project_id"), Op.EQ, item_list[0].project_id),
                    ],
                    orderby=[
                        OrderBy(Column("timestamp"), Direction.DESC),
                    ],
                    limit=Limit(100),
                    offset=Offset(0),
                ),
                tenant_ids={"organization_id": item_list[0].monitor.organization_id},
            )

            result = raw_snql_query(snql_request, "api.organization-events", use_cache=False)
            if "error" not in result:
                trace_groups = defaultdict(list)

                for event in result["data"]:
                    trace_groups[event["contexts[trace.trace_id]"]].append(event["group_id"])

                attrs = {
                    item: {
                        "group_ids": trace_groups.get(item.trace_id.hex) if item.trace_id else [],
                    }
                    for item in item_list
                }
        return attrs

    def serialize(self, obj, attrs, user):
        result = {
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

        if self._expand("group_ids"):
            result["group_ids"] = attrs["group_ids"]

        return result

    def _expand(self, key) -> bool:
        if self.expand is None:
            return False

        return key in self.expand


class MonitorCheckInSerializerResponse(TypedDict):
    id: str
    environment: str
    status: str
    duration: int
    dateCreated: datetime
    attachmentId: str
    expectedTime: datetime
    monitorConfig: Any
    group_ids: List[str]
