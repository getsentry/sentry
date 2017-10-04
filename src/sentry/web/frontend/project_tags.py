from __future__ import absolute_import

from sentry import tagstore
from sentry.web.frontend.base import ProjectView


class ProjectTagsView(ProjectView):
    def get(self, request, organization, team, project):
        tag_list = tagstore.get_tag_keys(project.id)

        context = {
            'tag_list': tag_list,
            'page': 'tags',
        }
        return self.respond('sentry/projects/manage_tags.html', context)
