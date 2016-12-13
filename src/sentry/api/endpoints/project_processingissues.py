from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProcessingIssue, ProcessingIssueGroup


class ProjectProcessingIssuesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's processing issues.
        """
        num_issues = ProcessingIssue.objects.filter(
            project=project
        ).count()
        num_groups = ProcessingIssueGroup.objects.filter(
            issue__project=project
        ).values('group').distinct().count()
        num_releases = ProcessingIssueGroup.objects.filter(
            issue__project=project
        ).values('release').distinct().count()

        data = {
            'hasIssues': num_issues > 0 and num_groups > 0,
            'affectedIssues': num_issues,
            'affectedGroups': num_groups,
            'affectedReleases': num_releases,
        }

        if request.GET.get('detailed') == '1':
            q = ProcessingIssue.objects.with_num_groups().filter(
                project=project
            ).order_by('type')
            data['issues'] = [serialize(x, request.user) for x in q]

        return Response(serialize(data, request.user))
