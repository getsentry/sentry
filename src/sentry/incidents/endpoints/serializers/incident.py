from collections import defaultdict
from datetime import datetime
from typing import TypedDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.incidentactivity import IncidentActivitySerializerResponse
from sentry.incidents.endpoints.serializers.alert_rule import (
    AlertRuleSerializerResponse,
    DetailedAlertRuleSerializer,
)
from sentry.incidents.models.incident import Incident, IncidentActivity, IncidentProject
from sentry.snuba.entity_subscription import apply_dataset_query_conditions
from sentry.snuba.models import SnubaQuery


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


@register(Incident)
class IncidentSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):
        prefetch_related_objects(item_list, "alert_rule__snuba_query")
        incident_projects = defaultdict(list)
        for incident_project in IncidentProject.objects.filter(
            incident__in=item_list
        ).select_related("project"):
            incident_projects[incident_project.incident_id].append(incident_project.project.slug)

        alert_rules = {
            d["id"]: d
            for d in serialize(
                {i.alert_rule for i in item_list if i.alert_rule.id},
                user,
                DetailedAlertRuleSerializer(expand=self.expand),
            )
        }

        results = {}
        for incident in item_list:
            results[incident] = {"projects": incident_projects.get(incident.id, [])}
            results[incident]["alert_rule"] = alert_rules.get(str(incident.alert_rule.id))  # type: ignore[assignment]

        if "activities" in self.expand:
            # There could be many activities. An incident could seesaw between error/warning for a long period.
            # e.g - every 1 minute for 10 months
            activities = list(IncidentActivity.objects.filter(incident__in=item_list)[:1000])
            incident_activities = defaultdict(list)
            for activity, serialized_activity in zip(activities, serialize(activities, user=user)):
                incident_activities[activity.incident_id].append(serialized_activity)
            for incident in item_list:
                results[incident]["activities"] = incident_activities[incident.id]

        return results

    def serialize(self, obj, attrs, user, **kwargs) -> IncidentSerializerResponse:
        date_closed = obj.date_closed.replace(second=0, microsecond=0) if obj.date_closed else None
        return {
            "id": str(obj.id),
            "identifier": str(obj.identifier),
            "organizationId": str(obj.organization_id),
            "projects": attrs["projects"],
            "alertRule": attrs["alert_rule"],
            "activities": attrs["activities"] if "activities" in self.expand else None,
            "status": obj.status,
            "statusMethod": obj.status_method,
            "type": obj.type,
            "title": obj.title,
            "dateStarted": obj.date_started,
            "dateDetected": obj.date_detected,
            "dateCreated": obj.date_added,
            "dateClosed": date_closed,
        }


class DetailedIncidentSerializer(IncidentSerializer):
    def __init__(self, expand=None):
        if expand is None:
            expand = []
        if "original_alert_rule" not in expand:
            expand.append("original_alert_rule")
        super().__init__(expand=expand)

    def serialize(self, obj, attrs, user, **kwargs) -> DetailedIncidentSerializerResponse:
        base_context = super().serialize(obj, attrs, user)
        # The query we should use to get accurate results in Discover.
        context = DetailedIncidentSerializerResponse(
            **base_context, discoverQuery=self._build_discover_query(obj)
        )

        return context

    def _build_discover_query(self, incident) -> str:
        return apply_dataset_query_conditions(
            SnubaQuery.Type(incident.alert_rule.snuba_query.type),
            incident.alert_rule.snuba_query.query,
            incident.alert_rule.snuba_query.event_types,
            discover=True,
        )
