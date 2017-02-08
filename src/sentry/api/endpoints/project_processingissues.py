from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProcessingIssue


class ProjectProcessingIssuesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's processing issues.
        """
        num_issues = ProcessingIssue.objects.filter(
            project=project
        ).count()

        last_seen = ProcessingIssue.objects.filter(
            project=project
        ).order_by('-datetime').first()

        data = {
            'hasIssues': num_issues > 0,
            'numIssues': num_issues,
            'lastSeen': serialize(last_seen.datetime),
        }

        if request.GET.get('detailed') == '1':
            q = ProcessingIssue.objects.with_num_events().filter(
                project=project
            ).order_by('type')
            data['issues'] = [serialize(x, request.user) for x in q]

        return Response(serialize(data, request.user))
