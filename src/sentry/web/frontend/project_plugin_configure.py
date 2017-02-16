from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponse

from sentry.plugins import plugins
from sentry.web.frontend.base import ProjectView


class ProjectPluginConfigureView(ProjectView):
    required_scope = 'project:write'

    def handle(self, request, organization, team, project, slug):
        try:
            plugin = plugins.get(slug)
        except KeyError:
            return self.redirect(reverse('sentry-manage-project', args=[project.organization.slug, project.slug]))

        if not plugin.can_configure_for_project(project):
            return self.redirect(reverse('sentry-manage-project', args=[project.organization.slug, project.slug]))

        is_enabled = plugin.is_enabled(project)
        view = plugin.configure(request=request, project=project)
        if isinstance(view, HttpResponse):
            return view

        context = {
            'page': 'plugin',
            'title': plugin.get_title(),
            'view': view,
            'plugin': plugin,
            'plugin_is_enabled': is_enabled,
        }

        return self.respond('sentry/projects/plugins/configure.html', context)
