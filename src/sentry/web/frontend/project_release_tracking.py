from __future__ import absolute_import

from hashlib import sha256
import hmac

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _
from uuid import uuid1

from sentry import constants
from sentry.models import ProjectOption
from sentry.plugins import plugins, ReleaseTrackingPlugin
from sentry.utils.http import absolute_uri
from sentry.web.frontend.base import ProjectView


OK_TOKEN_REGENERATED = _("Your deploy token has been regenerated. You will need to update any pre-existing deploy hooks.")

ERR_NO_FEATURE = _('The release tracking feature is not enabled for this project.')


class ProjectReleaseTrackingView(ProjectView):
    required_scope = 'project:write'

    def _iter_plugins(self):
        for plugin in plugins.all(version=2):
            if not isinstance(plugin, ReleaseTrackingPlugin):
                continue
            yield plugin

    def _handle_enable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])
        plugin.enable(project)
        messages.add_message(
            request, messages.SUCCESS,
            constants.OK_PLUGIN_ENABLED.format(name=plugin.get_title()),
        )

    def _handle_disable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])
        plugin.disable(project)
        messages.add_message(
            request, messages.SUCCESS,
            constants.OK_PLUGIN_DISABLED.format(name=plugin.get_title()),
        )

    def _regenerate_token(self, project):
        token = uuid1().hex
        ProjectOption.objects.set_value(project, 'sentry:release-token', token)
        return token

    def _get_signature(self, project_id, plugin_id, token):
        return hmac.new(
            key=str(token),
            msg='{}-{}'.format(plugin_id, project_id),
            digestmod=sha256
        ).hexdigest()

    def handle(self, request, organization, team, project):
        token = None

        if request.method == 'POST':
            op = request.POST.get('op')
            if op == 'regenerate-token':
                token = self._regenerate_token(project)
                messages.add_message(
                    request, messages.SUCCESS,
                    OK_TOKEN_REGENERATED,
                )
            elif op == 'enable':
                self._handle_enable_plugin(request, project)
            elif op == 'disable':
                self._handle_disable_plugin(request, project)
            return HttpResponseRedirect(request.path)

        if token is None:
            token = ProjectOption.objects.get_value(project, 'sentry:release-token')
        if token is None:
            token = self._regenerate_token(project)

        enabled_plugins = []
        other_plugins = []
        for plugin in self._iter_plugins():
            if plugin.is_enabled(project):
                hook_url = absolute_uri(reverse('sentry-release-hook', kwargs={
                    'plugin_id': plugin.slug,
                    'project_id': project.id,
                    'signature': self._get_signature(project.id, plugin.slug, token),
                }))
                content = plugin.get_release_doc_html(hook_url=hook_url)
                enabled_plugins.append((plugin, mark_safe(content)))
            elif plugin.can_configure_for_project(project):
                other_plugins.append(plugin)

        context = {
            'page': 'release-tracking',
            'token': token,
            'enabled_plugins': enabled_plugins,
            'other_plugins': other_plugins,
            'webhook_url': absolute_uri(reverse('sentry-release-hook', kwargs={
                'plugin_id': 'builtin',
                'project_id': project.id,
                'signature': self._get_signature(project.id, 'builtin', token),
            }))
        }

        return self.respond('sentry/project-release-tracking.html', context)
