from collections import defaultdict


from sentry.api.serializers import Serializer, register, serialize
from sentry.incidents.models import (
    Incident,
    IncidentActivity,
    IncidentProject,
    IncidentSeen,
    IncidentSubscription,
)
from sentry.snuba.models import QueryDatasets
from sentry.snuba.tasks import apply_dataset_query_conditions
from sentry.utils.db import attach_foreignkey


@register(Incident)
class IncidentSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):
        attach_foreignkey(item_list, Incident.alert_rule, related=("snuba_query",))
        incident_projects = defaultdict(list)
        for incident_project in IncidentProject.objects.filter(
            incident__in=item_list
        ).select_related("project"):
            incident_projects[incident_project.incident_id].append(incident_project.project.slug)

        alert_rules = {
            d["id"]: d
            for d in serialize({i.alert_rule for i in item_list if i.alert_rule.id}, user)
        }

        results = {}
        for incident in item_list:
            results[incident] = {"projects": incident_projects.get(incident.id, [])}
            results[incident]["alert_rule"] = alert_rules.get(str(incident.alert_rule.id))

        if "seen_by" in self.expand:
            incident_seen_list = list(
                IncidentSeen.objects.filter(incident__in=item_list)
                .select_related("user")
                .order_by("-last_seen")
            )
            incident_seen_dict = defaultdict(list)
            for incident_seen, serialized_seen_by in zip(
                incident_seen_list, serialize(incident_seen_list)
            ):
                incident_seen_dict[incident_seen.incident_id].append(serialized_seen_by)
            for incident in item_list:
                seen_by = incident_seen_dict[incident.id]
                has_seen = any(seen for seen in seen_by if seen["id"] == str(user.id))
                results[incident]["seen_by"] = seen_by
                results[incident]["has_seen"] = has_seen

        if "activities" in self.expand:
            activities = list(IncidentActivity.objects.filter(incident__in=item_list))
            incident_activities = defaultdict(list)
            for activity, serialized_activity in zip(activities, serialize(activities, user=user)):
                incident_activities[activity.incident_id].append(serialized_activity)
            for incident in item_list:
                results[incident]["activities"] = incident_activities[incident.id]

        return results

    def serialize(self, obj, attrs, user):
        date_closed = obj.date_closed.replace(second=0, microsecond=0) if obj.date_closed else None
        return {
            "id": str(obj.id),
            "identifier": str(obj.identifier),
            "organizationId": str(obj.organization_id),
            "projects": attrs["projects"],
            "alertRule": attrs["alert_rule"],
            "activities": attrs["activities"] if "activities" in self.expand else None,
            "seenBy": attrs["seen_by"] if "seen_by" in self.expand else None,
            "hasSeen": attrs["has_seen"] if "seen_by" in self.expand else None,
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
            expand = ["seen_by"]
        elif "seen_by" not in expand:
            expand.append("seen_by")
        super().__init__(expand=expand)

    def get_attrs(self, item_list, user, **kwargs):
        results = super().get_attrs(item_list, user=user, **kwargs)
        subscribed_incidents = set()
        if user.is_authenticated():
            subscribed_incidents = set(
                IncidentSubscription.objects.filter(incident__in=item_list, user=user).values_list(
                    "incident_id", flat=True
                )
            )

        for item in item_list:
            results[item]["is_subscribed"] = item.id in subscribed_incidents
        return results

    def serialize(self, obj, attrs, user):
        context = super().serialize(obj, attrs, user)
        context["isSubscribed"] = attrs["is_subscribed"]
        # The query we should use to get accurate results in Discover.
        context["discoverQuery"] = self._build_discover_query(obj)

        return context

    def _build_discover_query(self, incident):
        return apply_dataset_query_conditions(
            QueryDatasets(incident.alert_rule.snuba_query.dataset),
            incident.alert_rule.snuba_query.query,
            incident.alert_rule.snuba_query.event_types,
            discover=True,
        )
