from collections.abc import MutableMapping, Sequence
from typing import Any, Literal, TypedDict, cast, override

from django.db.models import prefetch_related_objects
from sentry_kafka_schemas.schema_types.snuba_uptime_results_v1 import (
    CheckStatus,
    CheckStatusReasonType,
)

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.types.actor import Actor
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription
from sentry.uptime.subscriptions.regions import get_region_config
from sentry.uptime.types import EapCheckEntry, IncidentStatus


class UptimeSubscriptionSerializerResponse(TypedDict):
    url: str
    method: str
    body: str | None
    headers: Sequence[tuple[str, str]]
    intervalSeconds: int
    timeoutMs: int
    traceSampling: bool


@register(UptimeSubscription)
class UptimeSubscriptionSerializer(Serializer):

    @override
    def serialize(self, obj: UptimeSubscription, attrs, user, **kwargs) -> dict[str, Any]:
        return {
            "url": obj.url,
            "method": obj.method,
            "body": obj.body,
            "headers": obj.headers,
            "intervalSeconds": obj.interval_seconds,
            "timeoutMs": obj.timeout_ms,
            "traceSampling": obj.trace_sampling,
        }


class ProjectUptimeSubscriptionSerializerResponse(UptimeSubscriptionSerializerResponse):
    id: str
    projectSlug: str
    environment: str | None
    name: str
    status: str
    uptimeStatus: int
    mode: int
    owner: ActorSerializerResponse


@register(ProjectUptimeSubscription)
class ProjectUptimeSubscriptionSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand

    def get_attrs(
        self, item_list: Sequence[ProjectUptimeSubscription], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        prefetch_related_objects(item_list, "uptime_subscription", "project", "environment")
        owners = list(filter(None, [item.owner for item in item_list]))
        owners_serialized = serialize(
            Actor.resolve_many(owners, filter_none=False), user, ActorSerializer()
        )
        serialized_owner_lookup = {
            owner: serialized_owner for owner, serialized_owner in zip(owners, owners_serialized)
        }

        return {
            item: {"owner": serialized_owner_lookup.get(item.owner) if item.owner else None}
            for item in item_list
        }

    def serialize(
        self, obj: ProjectUptimeSubscription, attrs, user, **kwargs
    ) -> ProjectUptimeSubscriptionSerializerResponse:
        serialized_subscription: UptimeSubscriptionSerializerResponse = serialize(
            obj.uptime_subscription
        )

        return {
            "id": str(obj.id),
            "projectSlug": obj.project.slug,
            "environment": obj.environment.name if obj.environment else None,
            "name": obj.name or f"Uptime Monitoring for {obj.uptime_subscription.url}",
            "status": obj.get_status_display(),
            "uptimeStatus": obj.uptime_subscription.uptime_status,
            "mode": obj.mode,
            "owner": attrs["owner"],
            **serialized_subscription,
        }


SerializedCheckStatus = CheckStatus | Literal["failure_incident"]
"""
Extends the CheckStatus type that is defined as part of the uptime check
results schema to add a `failure_incident` type used to indicate that the check
failed as part of an uptime incident.
"""


class EapCheckEntrySerializerResponse(TypedDict):
    uptimeCheckId: str
    uptimeSubscriptionId: int
    projectUptimeSubscriptionId: int
    timestamp: str
    scheduledCheckTime: str
    checkStatus: SerializedCheckStatus
    checkStatusReason: CheckStatusReasonType | None
    httpStatusCode: int | None
    durationMs: int
    traceId: str
    incidentStatus: int
    environment: str
    region: str
    regionName: str


@register(EapCheckEntry)
class EapCheckEntrySerializer(Serializer):

    def serialize(
        self, obj: EapCheckEntry, attrs, user, **kwargs
    ) -> EapCheckEntrySerializerResponse:
        check_status = cast(SerializedCheckStatus, obj.check_status)

        # XXX: Translate the status from `failed` to `failed_incident` when the
        # check is part of an incident.
        if check_status == "failure" and obj.incident_status == IncidentStatus.IN_INCIDENT:
            check_status = "failure_incident"

        region_config = get_region_config(obj.region)
        region_name = region_config.name if region_config else "Unknown"

        return {
            "uptimeCheckId": obj.uptime_check_id,
            "uptimeSubscriptionId": obj.uptime_subscription_id,
            "projectUptimeSubscriptionId": obj.uptime_subscription_id,
            "timestamp": obj.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "scheduledCheckTime": obj.scheduled_check_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "checkStatus": check_status,
            "checkStatusReason": obj.check_status_reason,
            "httpStatusCode": obj.http_status_code,
            "durationMs": obj.duration_ms,
            "traceId": obj.trace_id,
            "incidentStatus": obj.incident_status,
            "environment": obj.environment,
            "region": obj.region,
            "regionName": region_name,
        }
