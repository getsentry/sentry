from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, TypedDict

from sentry.apidocs.omissions import sentry_schema_serializer

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


@sentry_schema_serializer(
    omit_from_public_schema={
        "status": "Internal numeric alert-rule status; clients read the rule's state through other fields.",
        "resolution": "Internal resolution window derived from the rule's time window.",
        "thresholdPeriod": "Internal consecutive-breach counter used by the alert evaluator.",
        "weeklyAvg": "Computed rollup used by the alert rule UI.",
        "totalThisWeek": "Computed rollup used by the alert rule UI.",
        "latestIncident": "Embedded incident snapshot used by the alert rule UI.",
        "description": "Internal field distinct from the rule name; not part of the documented shape.",
        "sensitivity": "Anomaly-detection tuning, meaningful only for dynamic detection rules.",
        "seasonality": "Anomaly-detection tuning, meaningful only for dynamic detection rules.",
        "detectionType": "Anomaly-detection tuning, meaningful only for dynamic detection rules.",
    }
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
