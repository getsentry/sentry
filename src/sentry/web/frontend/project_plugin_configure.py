from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponse

from sentry.api import client
from sentry.plugins import plugins, IssueTrackingPlugin2, NotificationPlugin
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

        react_plugin = None
        is_enabled = plugin.is_enabled(project)
        if isinstance(plugin, IssueTrackingPlugin2) or isinstance(plugin, NotificationPlugin):
            view = None
            response = client.get('/projects/{}/{}/plugins/{}/'.format(
                organization.slug,
                project.slug,
                slug,
            ), request=request)
            react_plugin = response.data
        else:
            view = plugin.configure(request=request, project=project)
            if isinstance(view, HttpResponse):
                return view

        context = {
            'page': 'plugin',
            'title': plugin.get_title(),
            'view': view,
            'plugin': plugin,
            'plugin_is_enabled': is_enabled,
            'react_plugin': react_plugin,
        }

        return self.respond('sentry/projects/plugins/configure.html', context)
