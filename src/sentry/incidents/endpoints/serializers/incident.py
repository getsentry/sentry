from datetime import datetime
from typing import TypedDict

from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.interfaces.user import EventUserApiContext


class IncidentActivitySerializerResponse(TypedDict):
    """Legacy activity response shape, independent of the retired activity model."""

    id: str
    incidentIdentifier: str
    user: EventUserApiContext
    type: int
    value: str
    previousValue: str | None
    comment: str
    dateCreated: datetime


class IncidentSerializerResponse(TypedDict):
    id: str
    identifier: str
    organizationId: str
    projects: list[str]
    alertRule: AlertRuleSerializerResponse
    activities: list[IncidentActivitySerializerResponse] | None
    status: int
    statusMethod: int
    type: int
    title: str
    dateStarted: datetime
    dateDetected: datetime
    dateCreated: datetime
    dateClosed: datetime | None


class DetailedIncidentSerializerResponse(IncidentSerializerResponse):
    discoverQuery: str
