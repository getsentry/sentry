from __future__ import absolute_import

from sentry.models import ProjectKey
from sentry.web.frontend.base import ProjectView


class ProjectKeysView(ProjectView):
    def get(self, request, organization, team, project):
        key_list = list(ProjectKey.objects.filter(
            project=project,
        ).order_by('-id'))

        for key in key_list:
            key.project = project

        context = {
            'page': 'keys',
            'key_list': key_list,
        }

        return self.respond('sentry/projects/keys.html', context)
