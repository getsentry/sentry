from __future__ import absolute_import

from itertools import islice

from sentry.api.bases.incident import (
    IncidentEndpoint,
    IncidentPermission,
)
from sentry.incidents.logic import get_incident_suspects


class OrganizationIncidentSuspectsIndexEndpoint(IncidentEndpoint):
    permission_classes = (IncidentPermission, )

    def get(self, request, organization, incident):
        """
        Fetches potential causes of an Incident.
        ````````````````````````````````````````
        Fetches potential causes of an Incident. Currently this is just suspect
        commits for all related Groups.
        :auth: required
        """

        # Only fetch suspects for projects that the user has access to
        projects = [
            project for project in incident.projects.all()
            if request.access.has_project_access(project)
        ]
        suspects = islice(get_incident_suspects(incident, projects), 10)

        # TODO: For now just hard coding this format, as we add in more formats
        # we'll handle this in a more robust way.
        return self.respond([{'type': 'commit', 'data': suspect} for suspect in suspects])
