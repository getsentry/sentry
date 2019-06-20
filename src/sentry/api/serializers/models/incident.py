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
    bulk_build_incident_query_params,
    bulk_get_incident_aggregates,
    bulk_get_incident_event_stats,
)
from sentry.incidents.models import (
    Incident,
    IncidentGroup,
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

        incident_query_params_list = bulk_build_incident_query_params(item_list)
        bulk_event_stats = bulk_get_incident_event_stats(item_list, incident_query_params_list)
        bulk_aggregates = bulk_get_incident_aggregates(incident_query_params_list)

        for incident, event_stats, aggregates in zip(item_list, bulk_event_stats, bulk_aggregates):
            results[incident] = {
                'projects': incident_projects.get(incident.id, []),
                'event_stats': event_stats,
                'aggregates': aggregates,
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
            'type': obj.type,
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

        incident_groups = defaultdict(list)
        for incident_id, group_id in IncidentGroup.objects.filter(
            incident__in=item_list,
        ).values_list('incident_id', 'group_id'):
            incident_groups[incident_id].append(six.text_type(group_id))

        for item in item_list:
            results[item]['is_subscribed'] = item.id in subscribed_incidents
            results[item]['groups'] = incident_groups.get(item.id, [])
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
        seen_list = self._get_incident_seen_list(obj, user)

        context['isSubscribed'] = attrs['is_subscribed']
        context['seenBy'] = seen_list['seen_by']
        context['hasSeen'] = seen_list['has_seen']
        context['groups'] = attrs['groups']

        return context
