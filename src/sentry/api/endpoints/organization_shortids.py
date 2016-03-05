from __future__ import absolute_import

from rest_framework.response import Response

from django.db import transaction

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import Project
from sentry.utils.strings import validate_callsign


class ShortIdsUpdateEndpoint(OrganizationEndpoint):

    def put(self, request, organization):
        """
        Update Short IDs
        ````````````````

        Updates the call signs of projects within the organization.

        :pparam string organization_slug: the slug of the organization the
                                          short ID should be looked up in.
        :param callsigns: a dictionary of project IDs to their intended
                          callsigns.
        :auth: required
        """
        callsigns = request.DATA.get('callsigns', {})
        for project_id, callsign in callsigns.iteritems():
            callsign = validate_callsign(callsign)
            if callsign is None:
                return Response({'detail': 'invalid callsign "%s"' % callsign},
                                status=400)
            callsigns[project_id] = callsign

        if len(callsigns) != len(callsigns.values()):
            return Response({'detail': 'Duplicate callsigns'}, status=400)

        project_q = organization.project_set.filter(
            pk__in=[int(x) for x in callsigns if x.isdigit()]
        )

        rv = {}

        with transaction.atomic():
            projects = {}

            # Clear out all call-signs first so that we can move them
            # around through the uniqueness
            for project in project_q:
                projects[str(project.id)] = project
                project.callsign = None
                project.save()

            # Set new ones
            for project_id, callsign in callsigns.iteritems():
                project = projects.get(project_id)
                if project is None:
                    continue
                other = Project.objects.filter(
                    callsign=callsign,
                    organization=organization
                ).exclude(id=project.id).first()
                if other is not None:
                    if len(callsigns) != len(callsigns.values()):
                        return Response({'detail': 'Duplicate callsign %s'
                                         % callsign}, status=400)
                project.callsign = callsign
                project.update_option('sentry:reviewed-callsign', True)
                project.save()
                rv[project_id] = callsign

        return Response({
            'updated_short_ids': rv
        })
