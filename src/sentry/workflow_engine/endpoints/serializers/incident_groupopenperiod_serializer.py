from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.workflow_engine.models.incident_groupopenperiod import IncidentGroupOpenPeriod


class IncidentGroupOpenPeriodSerializerResponse(TypedDict):
    incidentId: str | None
    incidentIdentifier: str | None
    groupId: str
    openPeriodId: str


@register(IncidentGroupOpenPeriod)
class IncidentGroupOpenPeriodSerializer(Serializer):
    def serialize(
        self, obj: IncidentGroupOpenPeriod, attrs: Mapping[str, Any], user, **kwargs
    ) -> IncidentGroupOpenPeriodSerializerResponse:
        return {
            "incidentId": str(obj.incident_id) if obj.incident_id else None,
            "incidentIdentifier": str(obj.incident_identifier) if obj.incident_identifier else None,
            "groupId": str(obj.group_open_period.group_id),
            "openPeriodId": str(obj.group_open_period.id),
        }
