from collections.abc import Mapping
from typing import Any, ClassVar

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer
from sentry.api.serializers.models.incidentactivity import IncidentActivitySerializerResponse
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.incident import IncidentSerializerResponse
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod, IncidentType
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.types.group import PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class WorkflowEngineIncidentSerializer(Serializer):
    priority_to_incident_status: ClassVar[dict[PriorityLevel, IncidentStatus]] = {
        PriorityLevel.HIGH: IncidentStatus.CRITICAL,
        PriorityLevel.MEDIUM: IncidentStatus.WARNING,
        PriorityLevel.LOW: IncidentStatus.OPEN,
    }

    def __init__(self, expand=None):
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):

        results = {}
        for open_period in item_list:
            results[open_period] = {
                "alert_rule": self.get_alert_rule(open_period),
                "activities": self.get_incident_activities(open_period),
            }

        if "activities" in self.expand:
            # There could be many activities. An incident could seesaw between error/warning for a long period.
            # e.g - every 1 minute for 10 months
            for open_period in item_list:
                results[open_period]["activities"] = self.get_incident_activities(open_period)

        return results

    def get_incident_status(self, priority: PriorityLevel) -> IncidentStatus:
        return self.priority_to_incident_status[priority]

    def get_incident_activities(
        self, open_period: GroupOpenPeriod
    ) -> list[IncidentActivitySerializerResponse]:
        pass

    def get_alert_rule(self, open_period: GroupOpenPeriod) -> AlertRuleSerializerResponse:
        pass

    def serialize(
        self,
        obj: GroupOpenPeriod,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs,
    ) -> IncidentSerializerResponse:
        """
        Temporary serializer to take an OpenPeriod and serialize it for the old metric alert rule endpoints
        """

        date_closed = obj.date_ended.replace(second=0, microsecond=0) if obj.date_ended else None
        return {
            "id": str(obj.id),
            "identifier": str(obj.id),
            "organizationId": str(obj.project.organization.id),
            "projects": [obj.project.slug],
            "alertRule": attrs["alert_rule"],  # TODO: figure out how to replace this
            "activities": attrs["activities"] if "activities" in self.expand else None,
            "status": self.get_incident_status(obj.group.priority),
            "statusMethod": IncidentStatusMethod.RULE_TRIGGERED,  # We don't allow manual updates or status updates based on detector config updates
            "type": IncidentType.ALERT_TRIGGERED,  # IncidentType.Detected isn't used anymore
            "title": obj.title,
            "dateStarted": obj.date_started,
            "dateDetected": obj.date_started,  # In workflow engine, date_started is the date the incident was detected
            "dateCreated": obj.date_added,
            "dateClosed": date_closed,
        }
