from __future__ import absolute_import

from sentry.models import TagKey, TagKeyStatus
from sentry.web.frontend.base import ProjectView


class ProjectTagsView(ProjectView):
    def get(self, request, organization, team, project):
        tag_list = TagKey.objects.filter(
            project=project,
            status=TagKeyStatus.VISIBLE,
        )

        context = {
            'tag_list': tag_list,
            'page': 'tags',
        }
        return self.respond('sentry/projects/manage_tags.html', context)
