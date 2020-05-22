from __future__ import absolute_import

from collections import defaultdict

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.incidents.models import Incident, IncidentProject, IncidentSeen, IncidentSubscription
from sentry.snuba.models import QueryDatasets
from sentry.utils.db import attach_foreignkey


@register(Incident)
class IncidentSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        incident_projects = defaultdict(list)
        for incident_project in IncidentProject.objects.filter(
            incident__in=item_list
        ).select_related("project"):
            incident_projects[incident_project.incident_id].append(incident_project.project.slug)

        results = {}
        for incident in item_list:
            results[incident] = {"projects": incident_projects.get(incident.id, [])}

        return results

    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "identifier": six.text_type(obj.identifier),
            "organizationId": six.text_type(obj.organization_id),
            "projects": attrs["projects"],
            "status": obj.status,
            "statusMethod": obj.status_method,
            "type": obj.type,
            "title": obj.title,
            "dateStarted": obj.date_started,
            "dateDetected": obj.date_detected,
            "dateCreated": obj.date_added,
            "dateClosed": obj.date_closed,
        }


class DetailedIncidentSerializer(IncidentSerializer):
    def get_attrs(self, item_list, user, **kwargs):
        results = super(DetailedIncidentSerializer, self).get_attrs(item_list, user=user, **kwargs)
        attach_foreignkey(item_list, Incident.alert_rule, related=("snuba_query",))
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

    def _get_incident_seen_list(self, incident, user):
        incident_seen = list(
            IncidentSeen.objects.filter(incident=incident)
            .select_related("user")
            .order_by("-last_seen")
        )

        seen_by_list = []
        has_seen = False

        for seen_by in incident_seen:
            if seen_by.user == user:
                has_seen = True
            seen_by_list.append(serialize(seen_by))

        return {"seen_by": seen_by_list, "has_seen": has_seen}

    def serialize(self, obj, attrs, user):
        context = super(DetailedIncidentSerializer, self).serialize(obj, attrs, user)
        seen_list = self._get_incident_seen_list(obj, user)

        context["isSubscribed"] = attrs["is_subscribed"]
        context["seenBy"] = seen_list["seen_by"]
        context["hasSeen"] = seen_list["has_seen"]
        context["alertRule"] = serialize(obj.alert_rule, user)
        # The query we should use to get accurate results in Discover.
        context["discoverQuery"] = self._build_discover_query(obj)

        return context

    def _build_discover_query(self, incident):
        query = incident.alert_rule.snuba_query.query
        if QueryDatasets(incident.alert_rule.snuba_query.dataset) == QueryDatasets.EVENTS:
            condition = "event.type:error"
            query = "{} {}".format(condition, query) if query else condition

        return query
