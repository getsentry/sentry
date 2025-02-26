from collections.abc import MutableMapping, Sequence
from typing import Any, Literal, TypedDict, cast

from django.db.models import prefetch_related_objects
from sentry_kafka_schemas.schema_types.snuba_uptime_results_v1 import (
    CheckStatus,
    CheckStatusReasonType,
)

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.types.actor import Actor
from sentry.uptime.models import ProjectUptimeSubscription
from sentry.uptime.subscriptions.regions import get_region_config
from sentry.uptime.types import EapCheckEntry, IncidentStatus


class ProjectUptimeSubscriptionSerializerResponse(TypedDict):
    id: str
    projectSlug: str
    environment: str | None
    name: str
    status: str
    uptimeStatus: int
    mode: int
    url: str
    method: str
    body: str | None
    headers: Sequence[tuple[str, str]]
    intervalSeconds: int
    timeoutMs: int
    owner: ActorSerializerResponse
    traceSampling: bool


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
        headers = obj.uptime_subscription.headers

        # XXX: Temporary translation code. We want to support headers with the same keys, so convert to a list
        if isinstance(headers, dict):
            headers = [[key, val] for key, val in headers.items()]

        return {
            "id": str(obj.id),
            "projectSlug": obj.project.slug,
            "environment": obj.environment.name if obj.environment else None,
            "name": obj.name or f"Uptime Monitoring for {obj.uptime_subscription.url}",
            "status": obj.get_status_display(),
            "uptimeStatus": obj.uptime_status,
            "mode": obj.mode,
            "url": obj.uptime_subscription.url,
            "headers": headers,
            "body": obj.uptime_subscription.body,
            "method": obj.uptime_subscription.method,
            "intervalSeconds": obj.uptime_subscription.interval_seconds,
            "timeoutMs": obj.uptime_subscription.timeout_ms,
            "owner": attrs["owner"],
            "traceSampling": obj.uptime_subscription.trace_sampling,
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
    traceSpansCount: int
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
        trace_spans: dict[str, int] = kwargs.get("trace_spans", {})

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
            "traceSpansCount": trace_spans.get(obj.trace_id, 0),
            "incidentStatus": obj.incident_status,
            "environment": obj.environment,
            "region": obj.region,
            "regionName": region_name,
        }
