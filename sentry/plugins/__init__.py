"""
sentry.plugins
~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from sentry.web.helpers import render_to_response


class Response(object):
    def __init__(self, template, context=None):
        self.template = template
        self.context = context

    def respond(self, request, context=None):
        if self.context:
            context.update(self.context)
        return render_to_response(self.template, context, request)


class PluginMount(type):
    def __init__(cls, name, bases, attrs):
        if not hasattr(cls, 'plugins'):
            # This branch only executes when processing the mount point itself.
            # So, since this is a new plugin type, not an implementation, this
            # class shouldn't be registered as a plugin. Instead, it sets up a
            # list where plugins can be registered later.
            cls.plugins = {}
        else:
            # This must be a plugin implementation, which should be registered.
            # Simply appending it to the list is all that's needed to keep
            # track of it later.
            cls.slug = getattr(cls, 'slug', None) or cls.title.replace(' ', '-').lower()
            cls.plugins[cls.slug] = cls


class Plugin(object):
    """
    All children should allow **kwargs on all inherited methods.
    """

    __metaclass__ = PluginMount

    conf_key = None
    conf_title = None

    project_conf_form = None
    project_conf_template = 'sentry/plugins/project_configuration.html'

    site_conf_form = None
    site_conf_template = 'sentry/plugins/site_configuration.html'

    title = None

    enabled = True

    def __init__(self, request):
        self.request = request

    def get_view_response(self, group):
        self.selected = self.request.path == self.get_url(group)

        if not self.selected:
            return

        response = self.view(group)

        if not response:
            return

        if isinstance(response, HttpResponseRedirect):
            return response

        if not isinstance(response, Response):
            raise NotImplementedError('Please use self.render() when returning responses.')

        return response.respond(self.request, {
            'project': group.project,
            'group': group,
        })

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

    def configure(self, project):
        """
        Called when plugin is initialized to perform any pre-configuration.
        """

    def view(self, group, **kwargs):
        """
        Handles the view logic. If no response is given, we continue to the next action provider.
        """

    def before_events(self, group_list, **kwargs):
        """
        Allows preprocessing of groups in the list view.

        This is generally useful if you need to cache lookups
        for something like ``tags`` which would otherwise do
        multiple queries.
        """

    def tags(self, group, tag_list, **kwargs):
        """
        Modifies the tag list for a grouped message.
        """
        return tag_list

    def actions(self, group, action_list, **kwargs):
        """
        Modifies the action list for a grouped message.
        """
        return action_list

    def panels(self, group, panel_list, **kwargs):
        """
        Modifies the panel list for a grouped message.
        """
        return panel_list

    def widget(self, group, **kwargs):
        """
        Renders as a widget in the group details sidebar.
        """
