"""
sentry.plugins.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

__all__ = ('Plugin', 'plugins')

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.utils import InstanceManager


class Response(object):
    def __init__(self, template, context=None):
        self.template = template
        self.context = context

    def respond(self, request, context=None):
        from sentry.web.helpers import render_to_response

        if self.context:
            context.update(self.context)
        return render_to_response(self.template, context, request)


class PluginManager(InstanceManager):
    def for_project(self):
        for plugin in self.all():
            if not plugin.project_conf_form:
                continue
            yield plugin

    def for_site(self):
        for plugin in self.all():
            if not plugin.site_conf_form:
                continue
            yield plugin

    def get(self, slug):
        for plugin in self.all():
            if plugin.slug == slug:
                return plugin
        raise KeyError


plugins = PluginManager()


def PluginMount(manager):
    class PluginMount(type):
        def __new__(cls, name, bases, attrs):
            new_cls = type.__new__(cls, name, bases, attrs)
            if IPlugin in bases:
                return new_cls
            if not new_cls.title:
                new_cls.title = new_cls.__name__
            if not new_cls.slug:
                new_cls.slug = new_cls.title.replace(' ', '-').lower()
            manager.add('%s.%s' % (new_cls.__module__, new_cls.__name__))
            return new_cls
    return PluginMount


class IPlugin(object):
    """
    Plugin interface. Should not be inherited from directly.

    All children should allow **kwargs on all inherited methods.
    """
    conf_key = None
    conf_title = None

    project_conf_form = None
    project_conf_template = 'sentry/plugins/project_configuration.html'

    site_conf_form = None
    site_conf_template = 'sentry/plugins/site_configuration.html'

    title = None
    slug = None

    enabled = True

    def _get_option_key(self, key):
        return '%s:%s' % (self.get_conf_key(), key)

    def get_option(self, key, project=None):
        from .helpers import get_option
        return get_option(self._get_option_key(key), project)

    def set_option(self, key, value, project=None):
        from .helpers import set_option
        return set_option(self._get_option_key(key), value, project)

    def unset_option(self, key, project=None):
        from .helpers import unset_option
        return unset_option(self._get_option_key(key), project)

    def get_conf_key(self):
        if not self.conf_key:
            return self.conf_title.lower().replace(' ', '_')
        return self.conf_key

    def get_conf_title(self):
        return self.conf_title or self.get_title()

    def get_title(self):
        return self.title

    def redirect(self, url):
        return HttpResponseRedirect(url)

    def render(self, template, context=None):
        return Response(template, context)

    def get_url(self, group):
        return reverse('sentry-group-plugin-action', args=(group.project_id, group.pk, self.slug))

    # The following methods are specific to web requests

    def get_view_response(self, request, group):
        self.selected = request.path == self.get_url(group)

        if not self.selected:
            return

        response = self.view(request, group)

        if not response:
            return

        if isinstance(response, HttpResponseRedirect):
            return response

        if not isinstance(response, Response):
            raise NotImplementedError('Please use self.render() when returning responses.')

        return response.respond(request, {
            'project': group.project,
            'group': group,
        })

    def view(self, request, group, **kwargs):
        """
        Handles the view logic. If no response is given, we continue to the next action provider.
        """

    def before_events(self, request, group_list, **kwargs):
        """
        Allows preprocessing of groups in the list view.

        This is generally useful if you need to cache lookups
        for something like ``tags`` which would otherwise do
        multiple queries.
        """

    def tags(self, request, group, tag_list, **kwargs):
        """
        Modifies the tag list for a grouped message.
        """
        return tag_list

    def actions(self, request, group, action_list, **kwargs):
        """
        Modifies the action list for a grouped message.
        """
        return action_list

    def panels(self, request, group, panel_list, **kwargs):
        """
        Modifies the panel list for a grouped message.
        """
        return panel_list

    def widget(self, request, group, **kwargs):
        """
        Renders as a widget in the group details sidebar.
        """

    # Server side signals which do not have request context

    def post_process(self, group, event, is_new, is_sample, **kwargs):
        """
        Post processes an event after it has been saved.
        """


class Plugin(IPlugin):
    """
    """
    __metaclass__ = PluginMount(plugins)

