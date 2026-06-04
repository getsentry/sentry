from __future__ import annotations

from datetime import datetime
from typing import Any, NotRequired, TypedDict

from drf_spectacular.utils import extend_schema_serializer


class AlertRuleSerializerResponseOptional(TypedDict):
    environment: NotRequired[str | None]
    projects: NotRequired[list[str] | None]
    queryType: NotRequired[int | None]
    resolveThreshold: NotRequired[float | None]
    dataset: NotRequired[str | None]
    thresholdType: NotRequired[int | None]
    eventTypes: NotRequired[list[str] | None]
    owner: NotRequired[str | None]
    originalAlertRuleId: NotRequired[str | None]
    comparisonDelta: NotRequired[float | None]
    weeklyAvg: NotRequired[float | None]
    totalThisWeek: NotRequired[int | None]
    snooze: NotRequired[bool | None]
    latestIncident: NotRequired[datetime | None]
    errors: NotRequired[list[str] | None]
    sensitivity: NotRequired[str | None]
    seasonality: NotRequired[str | None]
    extrapolationMode: NotRequired[str | None]


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


class DetailedAlertRuleSerializerResponse(AlertRuleSerializerResponse):
    """
    Response type that includes additional snooze-related fields beyond the base
    AlertRuleSerializerResponse.
    """

    snoozeForEveryone: NotRequired[bool | None]
    snoozeCreatedBy: NotRequired[str | None]
