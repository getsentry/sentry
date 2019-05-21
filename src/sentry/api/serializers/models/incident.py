from __future__ import absolute_import

from collections import defaultdict

import six

from sentry.api.serializers import (
    Serializer,
    register,
    serialize,
)
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.incidents.logic import (
    get_incident_aggregates,
    get_incident_event_stats,
)
from sentry.incidents.models import (
    Incident,
    IncidentProject,
    IncidentSeen,
    IncidentSubscription,
)


@register(Incident)
class IncidentSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        incident_projects = defaultdict(list)
        for incident_project in IncidentProject.objects.filter(
                incident__in=item_list).select_related('project'):
            incident_projects[incident_project.incident_id].append(incident_project.project.slug)

        results = {}

        for incident in item_list:
            results[incident] = {
                'projects': incident_projects.get(incident.id, []),
                'event_stats': get_incident_event_stats(incident),
                'aggregates': get_incident_aggregates(incident),
            }

        return results

    def serialize(self, obj, attrs, user):
        serializer = SnubaTSResultSerializer(obj.organization, None, user)
        aggregates = attrs['aggregates']
        return {
            'id': six.text_type(obj.id),
            'identifier': six.text_type(obj.identifier),
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


class DetailedIncidentSerializer(IncidentSerializer):
    def get_attrs(self, item_list, user, **kwargs):
        results = super(DetailedIncidentSerializer, self).get_attrs(
            item_list,
            user=user,
            **kwargs
        )
        subscribed_incidents = set()
        if user.is_authenticated():
            subscribed_incidents = set(IncidentSubscription.objects.filter(
                incident__in=item_list,
                user=user,
            ).values_list('incident_id', flat=True))

        for item in item_list:
            results[item]['subscribed'] = item.id in subscribed_incidents
        return results

    def _get_incident_seen_list(self, incident, user):
        incident_seen = list(IncidentSeen.objects.filter(
            incident=incident
        ).select_related('user').order_by('-last_seen'))

        seen_by_list = []
        has_seen = False

        for seen_by in incident_seen:
            if seen_by.user == user:
                has_seen = True
            seen_by_list.append(serialize(seen_by))

        return {
            'seen_by': seen_by_list,
            'has_seen': has_seen,
        }

    def serialize(self, obj, attrs, user):
        context = super(DetailedIncidentSerializer, self).serialize(obj, attrs, user)
        context['subscribed'] = attrs['subscribed']
        seen_list = self._get_incident_seen_list(obj, user)
        context.update({
            'seenBy': seen_list['seen_by'],
            'hasSeen': seen_list['has_seen'],
        })
        return context
