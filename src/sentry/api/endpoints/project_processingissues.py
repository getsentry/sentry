from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize


class ProjectProcessingIssuesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's processing issues.
        """
        data = {
            'hasIssues': False,
            'affectedIssues': 0,
            'affectedGroups': 0,
            'affectedReleases': 0,
        }

        if request.GET.get('detailed') == '1':
            data['issues'] = []

        return Response(serialize(data, request.user))
