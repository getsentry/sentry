from collections import defaultdict
from collections.abc import MutableMapping, Sequence
from datetime import datetime
from typing import Any, Literal, TypedDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import ProjectSerializerResponse, Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.monitors.models import (
    MONITOR_ENVIRONMENT_ORDERING,
    Monitor,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
)
from sentry.monitors.processing_errors.errors import (
    CheckinProcessingError,
    CheckinProcessingErrorData,
)
from sentry.monitors.utils import fetch_associated_groups
from sentry.monitors.validators import IntervalNames
from sentry.types.actor import Actor


class MonitorEnvBrokenDetectionSerializerResponse(TypedDict):
    userNotifiedTimestamp: datetime
    environmentMutedTimestamp: datetime


@register(MonitorEnvBrokenDetection)
class MonitorEnvBrokenDetectionSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> MonitorEnvBrokenDetectionSerializerResponse:
        return {
            "userNotifiedTimestamp": obj.user_notified_timestamp,
            "environmentMutedTimestamp": obj.env_muted_timestamp,
        }


class MonitorIncidentSerializerResponse(TypedDict):
    startingTimestamp: datetime
    resolvingTimestamp: datetime
    brokenNotice: MonitorEnvBrokenDetectionSerializerResponse | None


@register(MonitorIncident)
class MonitorIncidentSerializer(Serializer):
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

    def serialize(self, obj, attrs, user, **kwargs) -> MonitorIncidentSerializerResponse:
        return {
            "startingTimestamp": obj.starting_timestamp,
            "resolvingTimestamp": obj.resolving_timestamp,
            "brokenNotice": attrs["broken_detection"],
        }


class MonitorEnvironmentSerializerResponse(TypedDict):
    name: str
    status: str
    isMuted: bool
    dateCreated: datetime
    lastCheckIn: datetime
    nextCheckIn: datetime
    nextCheckInLatest: datetime
    activeIncident: MonitorIncidentSerializerResponse | None


@register(MonitorEnvironment)
class MonitorEnvironmentSerializer(Serializer):
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

        return {
            monitor_env: {
                "environment": environments[monitor_env.environment_id],
                "active_incident": serialized_incidents.get(monitor_env.id),
            }
            for monitor_env in item_list
        }

    def serialize(self, obj, attrs, user, **kwargs) -> MonitorEnvironmentSerializerResponse:
        return {
            "name": attrs["environment"].name,
            "status": obj.get_status_display(),
            "isMuted": obj.is_muted,
            "dateCreated": obj.monitor.date_added,
            "lastCheckIn": obj.last_checkin,
            "nextCheckIn": obj.next_checkin,
            "nextCheckInLatest": obj.next_checkin_latest,
            "activeIncident": attrs["active_incident"],
        }


class MonitorConfigSerializerResponse(TypedDict):
    schedule_type: Literal["crontab", "interval"]
    schedule: str | tuple[int, IntervalNames]
    checkin_margin: int | None
    max_runtime: int | None
    timezone: str | None
    failure_issue_threshold: int | None
    recovery_threshold: int | None
    alert_rule_id: int | None


class MonitorAlertRuleTargetSerializerResponse(TypedDict):
    targetIdentifier: int
    targetType: str


class MonitorAlertRuleSerializerResponse(TypedDict):
    targets: list[MonitorAlertRuleTargetSerializerResponse]
    environment: str


class MonitorSerializerResponseOptional(TypedDict, total=False):
    alertRule: MonitorAlertRuleSerializerResponse


class MonitorSerializerResponse(MonitorSerializerResponseOptional):
    id: str
    name: str
    slug: str
    status: str
    isMuted: bool
    type: Literal["cron_job", "unknown"]
    config: MonitorConfigSerializerResponse
    dateCreated: datetime
    project: ProjectSerializerResponse
    environments: MonitorEnvironmentSerializerResponse
    owner: ActorSerializerResponse


class MonitorBulkEditResponse:
    updated: list[MonitorSerializerResponse]
    errored: list[MonitorSerializerResponse]


@register(Monitor)
class MonitorSerializer(Serializer):
    def __init__(self, environments=None, expand=None):
        self.environments = environments
        self.expand = expand

    def get_attrs(self, item_list, user, **kwargs):
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

        actors_serialized = serialize(Actor.resolve_many(filtered_actors), user, ActorSerializer())
        actor_data = {
            actor: serialized_actor
            for actor, serialized_actor in zip(filtered_actors, actors_serialized)
        }

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
        serialized_monitor_environments = defaultdict(list)
        for monitor_env, serialized in zip(
            monitor_environments, serialize(monitor_environments, user)
        ):
            serialized_monitor_environments[monitor_env.monitor_id].append(serialized)

        environment_data = {
            item.id: serialized_monitor_environments.get(item.id, []) for item in item_list
        }

        attrs = {
            item: {
                "project": projects_data[item.project_id] if item.project_id else None,
                "environments": environment_data[item.id],
                "owner": actor_data.get(item.owner_actor),
            }
            for item in item_list
        }

        if self._expand("alertRule"):
            for item in item_list:
                attrs[item]["alertRule"] = item.get_issue_alert_rule_data()

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
            "owner": attrs["owner"],
        }

        if self._expand("alertRule"):
            result["alertRule"] = attrs["alertRule"]

        return result

    def _expand(self, key) -> bool:
        if self.expand is None:
            return False

        return key in self.expand


class MonitorCheckInSerializerResponseOptional(TypedDict, total=False):
    groups: list[str]


class MonitorCheckInSerializerResponse(MonitorCheckInSerializerResponseOptional):
    id: str
    environment: str
    status: str
    duration: int
    dateCreated: datetime
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
        prefetch_related_objects(item_list, "monitor_environment")

        attrs: dict[MonitorCheckIn, dict[str, Any]] = defaultdict(dict)

        monitor_envs = [
            checkin.monitor_environment for checkin in item_list if checkin.monitor_environment_id
        ]
        envs = {
            env.id: env
            for env in Environment.objects.filter(id__in=[me.environment_id for me in monitor_envs])
        }
        for checkin in item_list:
            env_name = None
            if checkin.monitor_environment:
                env_name = envs[checkin.monitor_environment.environment_id].name

            attrs[checkin]["environment_name"] = env_name

        if self._expand("groups") and self.start and self.end:
            # aggregate all the trace_ids in the given set of check-ins
            trace_ids = []
            trace_groups: dict[str, list[dict[str, int | str]]] = defaultdict(list)

            for item in item_list:
                if item.trace_id:
                    trace_ids.append(item.trace_id.hex)

            if trace_ids:
                trace_groups = fetch_associated_groups(
                    trace_ids, self.organization_id, self.project_id, self.start, self.end
                )

            for checkin in item_list:
                attrs[checkin]["groups"] = (
                    trace_groups.get(checkin.trace_id.hex, []) if checkin.trace_id else []
                )

        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> MonitorCheckInSerializerResponse:
        result: MonitorCheckInSerializerResponse = {
            "id": str(obj.guid),
            "environment": attrs["environment_name"],
            "status": obj.get_status_display(),
            "duration": obj.duration,
            "dateCreated": obj.date_added,
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


@register(CheckinProcessingError)
class CheckinProcessingErrorSerializer(Serializer):
    def serialize(
        self, obj: CheckinProcessingError, attrs, user, **kwargs
    ) -> CheckinProcessingErrorData:
        return obj.to_dict()
