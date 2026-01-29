from collections.abc import MutableMapping, Sequence
from typing import Any, Literal, TypedDict, cast, override

from sentry_kafka_schemas.schema_types.snuba_uptime_results_v1 import (
    Assertion,
    CheckStatus,
    CheckStatusReasonType,
)

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.types.actor import Actor
from sentry.uptime.models import UptimeStatus, UptimeSubscription
from sentry.uptime.subscriptions.regions import get_region_config
from sentry.uptime.types import (
    DATA_SOURCE_UPTIME_SUBSCRIPTION,
    EapCheckEntry,
    IncidentStatus,
    UptimeSummary,
)
from sentry.workflow_engine.models import DataSourceDetector, DetectorState
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel

DETECTOR_PRIORITY_TO_UPTIME_STATUS = {
    DetectorPriorityLevel.OK: UptimeStatus.OK,
    DetectorPriorityLevel.HIGH: UptimeStatus.FAILED,
}


class UptimeSubscriptionSerializerResponse(TypedDict):
    url: str
    method: str
    body: str | None
    headers: Sequence[tuple[str, str]]
    intervalSeconds: int
    timeoutMs: int
    traceSampling: bool
    assertion: Any | None


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
            "assertion": obj.assertion,
        }


class UptimeDetectorSerializerResponse(UptimeSubscriptionSerializerResponse):
    id: str
    projectSlug: str
    environment: str | None
    name: str
    status: str
    uptimeStatus: int
    mode: int
    owner: ActorSerializerResponse
    recoveryThreshold: int
    downtimeThreshold: int


class UptimeDetectorSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[Detector], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        detector_state_lookup = {
            ds.detector_id: ds for ds in DetectorState.objects.filter(detector__in=item_list)
        }

        # Get uptime subscriptions through data source detectors
        data_source_detectors = DataSourceDetector.objects.filter(
            detector__in=item_list,
            data_source__type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
        ).select_related("data_source")

        subscription_by_id = {
            str(sub.id): sub
            for sub in UptimeSubscription.objects.filter(
                id__in=[dsd.data_source.source_id for dsd in data_source_detectors]
            )
        }

        detector_to_subscription = {
            dsd.detector_id: subscription_by_id.get(dsd.data_source.source_id)
            for dsd in data_source_detectors
        }

        # Serialize owners
        owners = [detector.owner for detector in item_list if detector.owner]
        owners_serialized = serialize(
            Actor.resolve_many(owners, filter_none=False), user, ActorSerializer()
        )
        owner_lookup = {owner: serialized for owner, serialized in zip(owners, owners_serialized)}

        return {
            detector: {
                "uptime_subscription": detector_to_subscription.get(detector.id),
                "detector_state": detector_state_lookup.get(detector.id),
                "owner": detector.owner and owner_lookup.get(detector.owner) or None,
            }
            for detector in item_list
        }

    def serialize(self, obj: Detector, attrs, user, **kwargs) -> UptimeDetectorSerializerResponse:
        uptime_subscription = attrs["uptime_subscription"]
        detector_state = attrs["detector_state"]

        if not uptime_subscription:
            # Handle case where we can't find the associated uptime subscription
            raise ValueError(f"Could not find UptimeSubscription for detector {obj.id}")

        serialized_subscription: UptimeSubscriptionSerializerResponse = serialize(
            uptime_subscription
        )

        if detector_state and detector_state.priority_level in DETECTOR_PRIORITY_TO_UPTIME_STATUS:
            uptime_status = DETECTOR_PRIORITY_TO_UPTIME_STATUS[detector_state.priority_level]
        else:
            uptime_status = UptimeStatus.OK

        return {
            "id": str(obj.id),
            "projectSlug": obj.project.slug,
            "environment": obj.config.get("environment"),
            "name": obj.name or f"Uptime Monitoring for {uptime_subscription.url}",
            "status": "active" if obj.enabled else "disabled",
            "uptimeStatus": uptime_status,
            "mode": obj.config.get("mode", 1),  # Default to MANUAL mode
            "owner": attrs["owner"],
            "recoveryThreshold": obj.config["recovery_threshold"],
            "downtimeThreshold": obj.config["downtime_threshold"],
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
    timestamp: str
    scheduledCheckTime: str
    checkStatus: SerializedCheckStatus
    checkStatusReason: CheckStatusReasonType | None
    assertionFailureData: Assertion | None
    httpStatusCode: int | None
    durationMs: int
    traceId: str
    traceItemId: str
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
            "timestamp": obj.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "scheduledCheckTime": obj.scheduled_check_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "checkStatus": check_status,
            "checkStatusReason": obj.check_status_reason,
            "assertionFailureData": obj.assertion_failure_data,
            "httpStatusCode": obj.http_status_code,
            "durationMs": obj.duration_ms,
            "traceId": obj.trace_id,
            "incidentStatus": obj.incident_status,
            "environment": obj.environment,
            "region": obj.region,
            "regionName": region_name,
            "traceItemId": obj.trace_item_id,
        }


class UptimeSummarySerializerResponse(TypedDict):
    totalChecks: int
    failedChecks: int
    downtimeChecks: int
    missedWindowChecks: int
    avgDurationUs: float


@register(UptimeSummary)
class UptimeSummarySerializer(Serializer):
    @override
    def serialize(
        self, obj: UptimeSummary, attrs: Any, user: Any, **kwargs: Any
    ) -> UptimeSummarySerializerResponse:
        return {
            "totalChecks": obj.total_checks,
            "failedChecks": obj.failed_checks,
            "downtimeChecks": obj.downtime_checks,
            "missedWindowChecks": obj.missed_window_checks,
            "avgDurationUs": obj.avg_duration_us,
        }
