from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from itertools import groupby
from operator import attrgetter
from typing import Annotated, Any, Literal, TypedDict, cast

from django.db.models import prefetch_related_objects

from sentry.api.serializers import ProjectSerializerResponse, Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.apidocs.descriptions import ApiDescription
from sentry.constants import ObjectStatusName
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.monitors.models import (
    MONITOR_ENVIRONMENT_ORDERING,
    Monitor,
    MonitorCheckIn,
    MonitorCheckInConfig,
    MonitorEnvBrokenDetection,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    ScheduleType,
)
from sentry.monitors.processing_errors.errors import (
    CheckinProcessingError,
    CheckinProcessingErrorData,
)
from sentry.monitors.utils import fetch_associated_groups
from sentry.monitors.validators import IntervalNames
from sentry.types.actor import Actor

# The names of the MonitorStatus and CheckInStatus choices, as get_status_display() returns them.
MonitorStatusName = Literal[
    "active", "disabled", "pending_deletion", "deletion_in_progress", "ok", "error"
]
CheckInStatusName = Literal["unknown", "ok", "error", "in_progress", "missed", "timeout"]


class MonitorEnvBrokenDetectionSerializerResponse(TypedDict):
    userNotifiedTimestamp: Annotated[
        datetime | None,
        ApiDescription(
            "When users were notified that the monitor environment looks broken (ISO 8601)"
        ),
    ]
    environmentMutedTimestamp: Annotated[
        datetime | None, ApiDescription("When the broken monitor environment was muted (ISO 8601)")
    ]


@register(MonitorEnvBrokenDetection)
class MonitorEnvBrokenDetectionSerializer(Serializer[MonitorEnvBrokenDetectionSerializerResponse]):
    def serialize(
        self,
        obj: MonitorEnvBrokenDetection,
        attrs: Mapping[Any, Any],
        user: Any,
        **kwargs: Any,
    ) -> MonitorEnvBrokenDetectionSerializerResponse:
        return {
            "userNotifiedTimestamp": obj.user_notified_timestamp,
            "environmentMutedTimestamp": obj.env_muted_timestamp,
        }


class MonitorIncidentSerializerResponse(TypedDict):
    startingTimestamp: Annotated[
        datetime | None, ApiDescription("When the incident started (ISO 8601)")
    ]
    resolvingTimestamp: Annotated[
        datetime | None, ApiDescription("When the incident was resolved (ISO 8601)")
    ]
    brokenNotice: Annotated[
        MonitorEnvBrokenDetectionSerializerResponse | None,
        ApiDescription(
            "Details of the broken monitor notice for the incident. Null when there's none"
        ),
    ]


@register(MonitorIncident)
class MonitorIncidentSerializer(Serializer[MonitorIncidentSerializerResponse]):
    def get_attrs(
        self, item_list: Sequence[Any], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        broken_detections = list(
            MonitorEnvBrokenDetection.objects.filter(monitor_incident__in=item_list)
        )
        serialized_broken_detections = {
            detection.monitor_incident_id: serialized
            for serialized, detection in zip(serialize(broken_detections, user), broken_detections)
        }
        return {
            incident: {"broken_detection": serialized_broken_detections.get(incident.id)}
            for incident in item_list
        }

    def serialize(
        self,
        obj: MonitorIncident,
        attrs: Mapping[Any, Any],
        user: Any,
        **kwargs: Any,
    ) -> MonitorIncidentSerializerResponse:
        return {
            "startingTimestamp": obj.starting_timestamp,
            "resolvingTimestamp": obj.resolving_timestamp,
            "brokenNotice": attrs["broken_detection"],
        }


class MonitorEnvironmentSerializerResponse(TypedDict):
    name: Annotated[str, ApiDescription("Name of the environment")]
    status: Annotated[MonitorStatusName, ApiDescription("Status of the monitor in the environment")]
    isMuted: Annotated[
        bool, ApiDescription("Whether incidents are muted for the monitor in the environment")
    ]
    dateCreated: Annotated[datetime, ApiDescription("When the monitor was created (ISO 8601)")]
    lastCheckIn: Annotated[
        datetime | None,
        ApiDescription(
            "When the most recent check-in was received, not counting missed check-ins (ISO 8601)"
        ),
    ]
    nextCheckIn: Annotated[
        datetime | None, ApiDescription("When the next check-in is expected (ISO 8601)")
    ]
    nextCheckInLatest: Annotated[
        datetime | None,
        ApiDescription(
            "Latest time the next check-in can arrive before it counts as missed (ISO 8601)"
        ),
    ]
    activeIncident: Annotated[
        MonitorIncidentSerializerResponse | None,
        ApiDescription(
            "Unresolved incident for the monitor in the environment. Null when there's none"
        ),
    ]


@register(MonitorEnvironment)
class MonitorEnvironmentSerializer(Serializer[MonitorEnvironmentSerializerResponse]):
    def get_attrs(
        self, item_list: Sequence[Any], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        env_ids = [
            monitor_env.environment_id for monitor_env in item_list if monitor_env.environment_id
        ]
        environments = {env.id: env for env in Environment.objects.filter(id__in=env_ids)}

        active_incidents = list(
            MonitorIncident.objects.filter(
                monitor_environment__in=item_list,
                resolving_checkin=None,
            )
        )
        serialized_incidents = {
            incident.monitor_environment_id: serialized_incident
            for incident, serialized_incident in zip(
                active_incidents, serialize(active_incidents, user)
            )
        }

        # Build date_added mapping, starting with cached monitors
        date_added_by_monitor_id = {}
        uncached_monitor_ids = set[int]()

        for monitor_env in item_list:
            if monitor_env.is_field_cached("monitor"):
                # Extract date_added from cached monitor
                date_added_by_monitor_id[monitor_env.monitor_id] = monitor_env.monitor.date_added
            else:
                # Need to fetch this monitor
                uncached_monitor_ids.add(monitor_env.monitor_id)

        # Batch query for uncached monitors - only fetch date_added field
        if uncached_monitor_ids:
            date_added_by_monitor_id.update(
                Monitor.objects.filter(id__in=uncached_monitor_ids).values_list("id", "date_added")
            )

        return {
            monitor_env: {
                "environment": environments.get(monitor_env.environment_id),
                "active_incident": serialized_incidents.get(monitor_env.id),
                "date_added": date_added_by_monitor_id[monitor_env.monitor_id],
            }
            for monitor_env in item_list
        }

    def serialize(
        self,
        obj: MonitorEnvironment,
        attrs: Mapping[Any, Any],
        user: Any,
        **kwargs: Any,
    ) -> MonitorEnvironmentSerializerResponse:
        environment = attrs["environment"]
        return {
            "name": environment.name if environment else "[removed]",
            "status": cast(MonitorStatusName, obj.get_status_display()),
            "isMuted": obj.is_muted,
            "dateCreated": attrs["date_added"],
            "lastCheckIn": obj.last_checkin,
            "nextCheckIn": obj.next_checkin,
            "nextCheckInLatest": obj.next_checkin_latest,
            "activeIncident": attrs["active_incident"],
        }


class MonitorConfigSerializerResponse(TypedDict):
    schedule_type: Annotated[
        Literal["crontab", "interval"], ApiDescription("Type of schedule: crontab or interval")
    ]
    schedule: Annotated[
        str | tuple[int, IntervalNames],
        ApiDescription(
            'Schedule of the monitor: a crontab string, or a [value, unit] pair for intervals, such as [1, "day"]'
        ),
    ]
    checkin_margin: Annotated[
        int | None,
        ApiDescription(
            "How long in minutes after the expected check-in time to wait before the check-in counts as missed"
        ),
    ]
    max_runtime: Annotated[
        int | None,
        ApiDescription(
            "How long in minutes a check-in can stay in progress before it counts as failed"
        ),
    ]
    timezone: Annotated[
        str | None, ApiDescription("Timezone the schedule is evaluated in, as a tz database name")
    ]
    failure_issue_threshold: Annotated[
        int | None,
        ApiDescription(
            "Number of consecutive missed or failed check-ins before an issue is created"
        ),
    ]
    recovery_threshold: Annotated[
        int | None,
        ApiDescription("Number of consecutive successful check-ins before the issue is resolved"),
    ]
    alert_rule_id: Annotated[
        int | None, ApiDescription("ID of the alert rule linked to the monitor")
    ]


class MonitorSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the monitor")]
    name: Annotated[str, ApiDescription("Name of the monitor")]
    slug: Annotated[str, ApiDescription("Slug that identifies the monitor in the organization")]
    status: Annotated[
        ObjectStatusName,
        ApiDescription("Status of the monitor. Disabled monitors don't accept check-ins"),
    ]
    isMuted: Annotated[
        bool, ApiDescription("Whether incidents are muted in all of the monitor's environments")
    ]
    isUpserting: Annotated[
        bool, ApiDescription("Whether the most recent check-in was an upsert check-in")
    ]
    config: Annotated[
        MonitorConfigSerializerResponse, ApiDescription("Configuration of the monitor")
    ]
    dateCreated: Annotated[datetime, ApiDescription("When the monitor was created (ISO 8601)")]
    project: Annotated[ProjectSerializerResponse, ApiDescription("Project the monitor belongs to")]
    environments: Annotated[
        list[MonitorEnvironmentSerializerResponse],
        ApiDescription("Environments the monitor has received check-ins for"),
    ]
    owner: Annotated[
        ActorSerializerResponse | None,
        ApiDescription("Team or user that owns the monitor. Null when there's no owner"),
    ]


class MonitorBulkEditResponse(TypedDict):
    updated: list[MonitorSerializerResponse]
    errored: list[MonitorSerializerResponse]


@register(Monitor)
class MonitorSerializer(Serializer[MonitorSerializerResponse]):
    def __init__(self, environments: Sequence[Environment] | None = None) -> None:
        self.environments = environments

    def get_attrs(
        self,
        item_list: Sequence[Monitor],
        user: Any,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
        # TODO(dcramer): assert on relations
        projects = Project.objects.filter(id__in=[i.project_id for i in item_list])
        projects_data = {
            project.id: serialized_project
            for project, serialized_project in zip(projects, serialize(list(projects), user))
        }

        actors = [Actor.from_id(user_id=m.owner_user_id) for m in item_list if m.owner_user_id]
        actors.extend(
            [Actor.from_id(team_id=m.owner_team_id) for m in item_list if m.owner_team_id]
        )
        filtered_actors = list(filter(None, actors))

        actors_serialized = serialize(
            Actor.resolve_many(filtered_actors, filter_none=False), user, ActorSerializer()
        )
        actor_data = {
            actor: serialized_actor
            for actor, serialized_actor in zip(filtered_actors, actors_serialized)
        }

        # Query ALL environments (unfiltered) to determine muted status
        # A monitor is muted only if ALL its environments are muted
        all_monitor_environments = (
            MonitorEnvironment.objects.filter(monitor__in=item_list)
            .exclude(
                status__in=[MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS]
            )
            .order_by("monitor_id")
        )

        # Group environments by monitor
        monitor_envs_by_id = {
            monitor_id: list(envs)
            for monitor_id, envs in groupby(all_monitor_environments, key=attrgetter("monitor_id"))
        }

        # A monitor is muted only if it has environments AND all of them are muted
        is_muted_data = {
            item.id: bool(monitor_envs_by_id.get(item.id, []))
            and all(env.is_muted for env in monitor_envs_by_id.get(item.id, []))
            for item in item_list
        }

        # Now query the filtered environments for serialization
        monitor_environments_qs = (
            MonitorEnvironment.objects.filter(monitor__in=item_list)
            .annotate(status_ordering=MONITOR_ENVIRONMENT_ORDERING)
            .order_by("status_ordering", "-last_checkin", "environment_id")
            .exclude(
                status__in=[MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS]
            )
        )
        if self.environments:
            monitor_environments_qs = monitor_environments_qs.filter(
                environment_id__in=[env.id for env in self.environments]
            )

        monitor_environments = list(monitor_environments_qs)

        # Pre-cache monitors on the environments to avoid queries in MonitorEnvironmentSerializer
        monitors_by_id = {monitor.id: monitor for monitor in item_list}
        for monitor_env in monitor_environments:
            monitor_env.set_cached_field_value("monitor", monitors_by_id[monitor_env.monitor_id])

        serialized_monitor_environments = defaultdict(list)

        for monitor_env, serialized in zip(
            monitor_environments, serialize(monitor_environments, user)
        ):
            serialized_monitor_environments[monitor_env.monitor_id].append(serialized)

        environment_data = {
            item.id: serialized_monitor_environments.get(item.id, []) for item in item_list
        }

        return {
            item: {
                "project": projects_data[item.project_id] if item.project_id else None,
                "environments": environment_data[item.id],
                "owner": actor_data.get(item.owner_actor) if item.owner_actor else None,
                "is_muted": is_muted_data[item.id],
            }
            for item in item_list
        }

    def serialize(
        self,
        obj: Monitor,
        attrs: Mapping[Any, Any],
        user: Any,
        **kwargs: Any,
    ) -> MonitorSerializerResponse:
        config = obj.config.copy()
        if "schedule_type" in config:
            config["schedule_type"] = obj.get_schedule_type_display()

        result: MonitorSerializerResponse = {
            "id": str(obj.guid),
            "status": cast(ObjectStatusName, obj.get_status_display()),
            "isMuted": attrs["is_muted"],
            "isUpserting": obj.is_upserting,
            "name": obj.name,
            "slug": obj.slug,
            "config": config,
            "dateCreated": obj.date_added,
            "project": attrs["project"],
            "environments": attrs["environments"],
            "owner": attrs["owner"],
        }

        return result


class MonitorCheckInSerializerResponseOptional(TypedDict, total=False):
    groups: Annotated[
        list[str],
        ApiDescription(
            "Issues linked to the check-in's trace. Only included when requested with expand=groups"
        ),
    ]


class MonitorCheckInSerializerResponse(MonitorCheckInSerializerResponseOptional):
    id: Annotated[str, ApiDescription("ID of the check-in")]
    environment: Annotated[str, ApiDescription("Name of the environment the check-in belongs to")]
    status: Annotated[CheckInStatusName, ApiDescription("Status of the check-in")]
    duration: Annotated[int | None, ApiDescription("Duration of the job run in milliseconds")]
    dateCreated: Annotated[
        datetime | None, ApiDescription("When the check-in was stored (ISO 8601)")
    ]
    dateAdded: Annotated[datetime, ApiDescription("When the check-in was received (ISO 8601)")]
    dateUpdated: Annotated[
        datetime, ApiDescription("When the check-in was last updated (ISO 8601)")
    ]
    dateInProgress: Annotated[
        datetime | None,
        ApiDescription(
            "When the first in_progress check-in was received (ISO 8601). Null when none was sent"
        ),
    ]
    dateClock: Annotated[
        datetime | None,
        ApiDescription(
            "Clock time the check-in was processed at, relative to other check-in tasks (ISO 8601)"
        ),
    ]
    expectedTime: Annotated[
        datetime | None, ApiDescription("When the check-in was expected (ISO 8601)")
    ]
    monitorConfig: Annotated[
        MonitorConfigSerializerResponse,
        ApiDescription("Monitor configuration when the check-in was received"),
    ]


@register(MonitorCheckIn)
class MonitorCheckInSerializer(Serializer[MonitorCheckInSerializerResponse]):
    def __init__(
        self,
        start: datetime | None = None,
        end: datetime | None = None,
        expand: Sequence[str] | None = None,
        organization_id: int | None = None,
        project_id: int | None = None,
    ) -> None:
        self.start = start  # timestamp of the beginning of the specified date range
        self.end = end  # timestamp of the end of the specified date range
        self.expand = expand
        self.organization_id = organization_id
        self.project_id = project_id

    def get_attrs(
        self,
        item_list: Sequence[MonitorCheckIn],
        user: Any,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
        # prefetch monitor environment data
        prefetch_related_objects(item_list, "monitor_environment")

        attrs: dict[MonitorCheckIn, dict[str, Any]] = defaultdict(dict)

        monitor_envs = [
            checkin.monitor_environment for checkin in item_list if checkin.monitor_environment_id
        ]
        envs = {
            env.id: env
            for env in Environment.objects.filter(id__in=[me.environment_id for me in monitor_envs])
        }
        checkin_configs = dict(
            MonitorCheckInConfig.objects.filter(
                id__in={c.checkin_config_id for c in item_list if c.checkin_config_id}
            ).values_list("id", "config")
        )

        for checkin in item_list:
            env_name = None
            if checkin.monitor_environment:
                env = envs.get(checkin.monitor_environment.environment_id)
                env_name = env.name if env else "[removed]"

            attrs[checkin]["environment_name"] = env_name
            attrs[checkin]["monitor_config"] = checkin_configs.get(
                checkin.checkin_config_id, checkin.monitor_config
            )

        if self._expand("groups") and self.start and self.end:
            # aggregate all the trace_ids in the given set of check-ins
            trace_ids = []
            trace_groups: dict[str, list[dict[str, int | str]]] = defaultdict(list)

            for item in item_list:
                if item.trace_id:
                    trace_ids.append(item.trace_id.hex)

            if trace_ids:
                trace_groups = fetch_associated_groups(
                    trace_ids,
                    cast("int", self.organization_id),
                    cast("int", self.project_id),
                    self.start,
                    self.end,
                )

            for checkin in item_list:
                attrs[checkin]["groups"] = (
                    trace_groups.get(checkin.trace_id.hex, []) if checkin.trace_id else []
                )

        return attrs

    def serialize(
        self,
        obj: MonitorCheckIn,
        attrs: Mapping[Any, Any],
        user: Any,
        **kwargs: Any,
    ) -> MonitorCheckInSerializerResponse:
        monitor_config = attrs["monitor_config"]
        config = monitor_config.copy() if monitor_config else {}
        if "schedule_type" in config:
            # XXX: We don't use monitor.get_schedule_type_display() in case it differs from the
            # config saved on the check-in
            config["schedule_type"] = ScheduleType.get_name(config["schedule_type"])
        result: MonitorCheckInSerializerResponse = {
            "id": str(obj.guid),
            "environment": attrs["environment_name"],
            "status": cast(CheckInStatusName, obj.get_status_display()),
            "duration": obj.duration,
            "dateCreated": obj.date_created,
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
            "dateClock": obj.date_clock,
            "dateInProgress": obj.date_in_progress,
            "expectedTime": obj.expected_time,
            "monitorConfig": cast(MonitorConfigSerializerResponse, config),
        }

        if self._expand("groups"):
            result["groups"] = attrs.get("groups", [])

        return result

    def _expand(self, key: str) -> bool:
        if self.expand is None:
            return False

        return key in self.expand


@register(CheckinProcessingError)
class CheckinProcessingErrorSerializer(Serializer[CheckinProcessingErrorData]):
    def serialize(
        self,
        obj: CheckinProcessingError,
        attrs: Mapping[Any, Any],
        user: Any,
        **kwargs: Any,
    ) -> CheckinProcessingErrorData:
        return obj.to_dict()
