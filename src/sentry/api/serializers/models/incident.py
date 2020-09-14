from __future__ import absolute_import

from collections import defaultdict

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.incidents.models import Incident, IncidentProject, IncidentSubscription
from sentry.models import User
from sentry.snuba.models import QueryDatasets
from sentry.utils.db import attach_foreignkey


@register(Incident)
class IncidentSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attach_foreignkey(item_list, Incident.alert_rule, related=("snuba_query",))
        incident_projects = defaultdict(list)
        for incident_project in IncidentProject.objects.filter(
            incident__in=item_list
        ).select_related("project"):
            incident_projects[incident_project.incident_id].append(incident_project.project.slug)

        alert_rules = {
            d["id"]: d
            for d in serialize(set(i.alert_rule for i in item_list if i.alert_rule.id), user)
        }

        results = {}
        for incident in item_list:
            results[incident] = {"projects": incident_projects.get(incident.id, [])}
            results[incident]["alert_rule"] = alert_rules.get(six.text_type(incident.alert_rule.id))

        return results

    def serialize(self, obj, attrs, user):
        date_closed = obj.date_closed.replace(second=0, microsecond=0) if obj.date_closed else None
        return {
            "id": six.text_type(obj.id),
            "identifier": six.text_type(obj.identifier),
            "organizationId": six.text_type(obj.organization_id),
            "projects": attrs["projects"],
            "alertRule": attrs["alert_rule"],
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
    def get_attrs(self, item_list, user, **kwargs):
        results = super(DetailedIncidentSerializer, self).get_attrs(item_list, user=user, **kwargs)
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
        seen_by_list = list(
            User.objects.filter(incidentseen__incident=incident).order_by(
                "-incidentseen__last_seen"
            )
        )

        has_seen = any(seen_by for seen_by in seen_by_list if seen_by.id == user.id)

        return {"seen_by": serialize(seen_by_list), "has_seen": has_seen}

    def serialize(self, obj, attrs, user):
        context = super(DetailedIncidentSerializer, self).serialize(obj, attrs, user)
        seen_list = self._get_incident_seen_list(obj, user)

        context["isSubscribed"] = attrs["is_subscribed"]
        context["seenBy"] = seen_list["seen_by"]
        context["hasSeen"] = seen_list["has_seen"]
        # The query we should use to get accurate results in Discover.
        context["discoverQuery"] = self._build_discover_query(obj)

        return context

    def _build_discover_query(self, incident):
        query = incident.alert_rule.snuba_query.query
        dataset = QueryDatasets(incident.alert_rule.snuba_query.dataset)
        condition = None

        if dataset == QueryDatasets.EVENTS:
            condition = "event.type:error"
        elif dataset == QueryDatasets.TRANSACTIONS:
            condition = "event.type:transaction"

        if condition:
            query = "{} {}".format(condition, query) if query else condition

        return query
