from __future__ import absolute_import

from collections import defaultdict

import six

from sentry.api.serializers import (
    Serializer,
    register,
)
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.incidents.logic import (
    get_incident_aggregates,
    get_incident_event_stats,
)
from sentry.incidents.models import (
    Incident,
    IncidentProject,
)


@register(Incident)
class IncidentSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        incident_projects = defaultdict(list)
        for incident_project in IncidentProject.objects.filter(
                incident__in=item_list).select_related('project'):
            incident_projects[incident_project.incident_id].append(incident_project.project.slug)

        results = {}
        for item in item_list:
            results[item] = {'projects': incident_projects.get(item.id, [])}

        for incident in item_list:
            results[item]['event_stats'] = get_incident_event_stats(incident)
            results[item]['aggregates'] = get_incident_aggregates(incident)

        return results

    def serialize(self, obj, attrs, user):
        serializer = SnubaTSResultSerializer(obj.organization, None, user)
        aggregates = attrs['aggregates']
        return {
            'id': six.text_type(obj.id),
            'identifier': obj.identifier,
            'organizationId': six.text_type(obj.organization_id),
            'projects': attrs['projects'],
            'status': obj.status,
            'title': obj.title,
            'query': obj.query,
            'dateStarted': obj.date_started,
            'dateDetected': obj.date_detected,
            'dateAdded': obj.date_added,
            'dateClosed': obj.date_closed,
            'eventStats': serializer.serialize(attrs['event_stats']),
            'totalEvents': aggregates['count'],
            'uniqueUsers': aggregates['unique_users'],
        }
