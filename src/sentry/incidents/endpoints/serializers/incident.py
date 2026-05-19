from datetime import datetime
from typing import TypedDict

from sentry.api.serializers.models.incidentactivity import IncidentActivitySerializerResponse
from sentry.incidents.endpoints.serializers.alert_rule import (
    AlertRuleSerializerResponse,
)


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
