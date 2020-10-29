from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.incidents.logic import get_incident_stats


class OrganizationIncidentStatsEndpoint(IncidentEndpoint):
    permission_classes = (IncidentPermission,)

    def get(self, request, organization, incident):
        """
        Fetch total event counts, unique user counts and trend graph for an Incident.
        ``````````````````
        :auth: required
        """
        stats = get_incident_stats(incident, windowed_stats=True)
        event_stats_serializer = SnubaTSResultSerializer(organization, None, request.user)
        results = {
            "eventStats": event_stats_serializer.serialize(stats["event_stats"]),
            "totalEvents": stats["total_events"],
            "uniqueUsers": stats["unique_users"],
        }
        return Response(results)
