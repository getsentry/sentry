from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, TypedDict

from drf_spectacular.utils import extend_schema_serializer

if TYPE_CHECKING:
    from sentry.incidents.endpoints.serializers.incident import IncidentSerializerResponse


class AlertRuleSerializerResponseOptional(TypedDict, total=False):
    environment: str | None
    projects: list[str] | None
    queryType: int | None
    resolveThreshold: float | None
    dataset: str | None
    thresholdType: int | None
    eventTypes: list[str] | None
    owner: str | None
    originalAlertRuleId: str | None
    comparisonDelta: float | None
    weeklyAvg: float | None
    totalThisWeek: int | None
    snooze: bool | None
    latestIncident: IncidentSerializerResponse | None
    errors: list[str] | None
    sensitivity: str | None
    seasonality: str | None
    extrapolationMode: str | None


@extend_schema_serializer(
    exclude_fields=[
        "status",
        "resolution",
        "thresholdPeriod",
        "weeklyAvg",
        "totalThisWeek",
        "latestIncident",
        "description",  # TODO: remove this once the feature has been released to add to the public docs, being sure to denote it will only display in Slack notifications
        "sensitivity",  # For anomaly detection, which is behind a feature flag
        "seasonality",  # For anomaly detection, which is behind a feature flag
        "detectionType",  # For anomaly detection, which is behind a feature flag
    ]
)
class AlertRuleSerializerResponse(AlertRuleSerializerResponseOptional):
    """
    This represents a Sentry Metric Alert Rule.
    """

    id: str
    name: str
    organizationId: str
    status: int
    query: str
    aggregate: str
    timeWindow: float
    resolution: float
    thresholdPeriod: int
    triggers: list[dict[str, Any]]
    dateModified: datetime
    dateCreated: datetime
    createdBy: dict[str, Any]
    description: str
    detectionType: str


class DetailedAlertRuleSerializerResponse(AlertRuleSerializerResponse, total=False):
    """
    Response type that includes additional snooze-related fields beyond the base
    AlertRuleSerializerResponse.
    """

    snoozeForEveryone: bool | None
    snoozeCreatedBy: str | None
