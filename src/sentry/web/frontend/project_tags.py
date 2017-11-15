from __future__ import absolute_import

from sentry import tagstore
from sentry.api.base import EnvironmentMixin
from sentry.models import Environment
from sentry.web.frontend.base import ProjectView


class ProjectTagsView(ProjectView, EnvironmentMixin):
    def get(self, request, organization, team, project):
        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            tag_list = []
        else:
            tag_list = sorted(
                tagstore.get_tag_keys(
                    project.id,
                    environment_id
                ),
                key=lambda x: x.key)

        context = {
            'tag_list': tag_list,
            'page': 'tags',
        }
        return self.respond('sentry/projects/manage_tags.html', context)
