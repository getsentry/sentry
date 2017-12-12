from __future__ import absolute_import

from django.contrib import messages
from django.utils.translation import ugettext_lazy as _

from sentry.plugins import plugins
from sentry.web.frontend.base import ProjectView


class ProjectPluginsView(ProjectView):
    required_scope = 'project:write'

    def handle(self, request, organization, team, project):
        if request.POST:
            enabled = set(request.POST.getlist('plugin'))
            for plugin in plugins.configurable_for_project(project, version=None):
                if plugin.slug in enabled:
                    plugin.enable(project)
                else:
                    plugin.disable(project)

            messages.add_message(
                request, messages.SUCCESS, _('Your settings were saved successfully.')
            )

            return self.redirect(request.path)
