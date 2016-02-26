from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint


class ShortIdsUpdateEndpoint(OrganizationEndpoint):

    def put(self, request, organization):
        """
        Update Short IDs
        ````````````````

        Updates the call signs of projects within the organization.

        :pparam string organization_slug: the slug of the organization the
                                          short ID should be looked up in.
        :param projects: a dictionary of project IDs to their intended
                         short IDs.
        :auth: required
        """
        projects = dict((str(p.id), p) for p in organization.project_set.all())
        rv = {}

        for project_id, callsign in request.DATA.get('projects', {}).iteritems():
            project = projects.get(project_id)
            if project is None:
                continue
            project.callsign = callsign
            project.update_option('sentry:reviewed-short-id', True)
            rv[project.id] = callsign

        return Response({
            'updated_short_ids': rv
        })
