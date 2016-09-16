"""
sentry.plugins.base.v1
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

__all__ = ('Plugin',)

import logging
import six

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from threading import local

from sentry.auth import access
from sentry.plugins.config import PluginConfigMixin
from sentry.plugins.base.response import Response
from sentry.plugins.base.view import PluggableViewMixin
from sentry.plugins.base.configuration import (
    default_plugin_config, default_plugin_options,
)
from sentry.utils.hashlib import md5_text


class PluginMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls = type.__new__(cls, name, bases, attrs)
        if IPlugin in bases:
            return new_cls
        if new_cls.title is None:
            new_cls.title = new_cls.__name__
        if not new_cls.slug:
            new_cls.slug = new_cls.title.replace(' ', '-').lower()
        if not hasattr(new_cls, 'logger') or new_cls.logger in [getattr(b, 'logger', None) for b in bases]:
            new_cls.logger = logging.getLogger('sentry.plugins.%s' % (new_cls.slug,))
        return new_cls


class IPlugin(local, PluggableViewMixin, PluginConfigMixin):
    """
    Plugin interface. Should not be inherited from directly.

    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.

    >>> from sentry.plugins import Plugin  # NOQA
    >>> class MyPlugin(Plugin):
    >>>     title = 'My Plugin'
    >>>
    >>>     def widget(self, request, group, **kwargs):
    >>>         return self.render('myplugin/widget.html')

    All children should allow ``**kwargs`` on all inherited methods.
    """
    # Generic plugin information
    title = None
    slug = None
    description = None
    version = None
    author = None
    author_url = None
    resource_links = ()

    # Configuration specifics
    conf_key = None
    conf_title = None

    project_conf_form = None
    project_conf_template = 'sentry/plugins/project_configuration.html'

    site_conf_form = None
    site_conf_template = 'sentry/plugins/site_configuration.html'

    # Global enabled state
    enabled = True
    can_disable = True

    # Should this plugin be enabled by default for projects?
    project_default_enabled = False

    def _get_option_key(self, key):
        return '%s:%s' % (self.get_conf_key(), key)

    def get_plugin_type(self):
        return 'default'

    def is_enabled(self, project=None):
        """
        Returns a boolean representing if this plugin is enabled.

        If ``project`` is passed, it will limit the scope to that project.

        >>> plugin.is_enabled()
        """
        if not self.enabled:
            return False
        if not self.can_disable:
            return True
        if not self.can_enable_for_projects():
            return True

        if project:
            project_enabled = self.get_option('enabled', project)
            if project_enabled is not None:
                return project_enabled
            else:
                return self.project_default_enabled

        return True

    def reset_options(self, project=None, user=None):
        from sentry.plugins.helpers import reset_options
        return reset_options(self.get_conf_key(), project, user)

    def get_option(self, key, project=None, user=None):
        """
        Returns the value of an option in your plugins keyspace, or ``None`` if
        one is not present.

        If ``project`` is passed, it will limit the scope to that project's keyspace.

        >>> value = plugin.get_option('my_option')
        """
        from sentry.plugins.helpers import get_option
        return get_option(self._get_option_key(key), project, user)

    def set_option(self, key, value, project=None, user=None):
        """
        Updates the value of an option in your plugins keyspace.

        If ``project`` is passed, it will limit the scope to that project's keyspace.

        >>> plugin.set_option('my_option', 'http://example.com')
        """
        from sentry.plugins.helpers import set_option
        return set_option(self._get_option_key(key), value, project, user)

    def unset_option(self, key, project=None, user=None):
        """
        Removes an option in your plugins keyspace.

        If ``project`` is passed, it will limit the scope to that project's keyspace.

        >>> plugin.unset_option('my_option')
        """
        from sentry.plugins.helpers import unset_option
        return unset_option(self._get_option_key(key), project, user)

    def enable(self, project=None, user=None):
        """Enable the plugin."""
        self.set_option('enabled', True, project, user)

    def disable(self, project=None, user=None):
        """Disable the plugin."""
        self.set_option('enabled', False, project, user)

    def get_url(self, group):
        """
        Returns the absolute URL to this plugins group action handler.

        >>> plugin.get_url(group)
        """
        return reverse('sentry-group-plugin-action', args=(group.organization.slug, group.project.slug, group.pk, self.slug))

    def get_conf_key(self):
        """
        Returns a string representing the configuration keyspace prefix for this plugin.
        """
        if not self.conf_key:
            return self.get_conf_title().lower().replace(' ', '_')
        return self.conf_key

    def get_conf_form(self, project=None):
        """
        Returns the Form required to configure the plugin.

        >>> plugin.get_conf_form(project)
        """
        if project is not None:
            return self.project_conf_form
        return self.site_conf_form

    def get_conf_template(self, project=None):
        """
        Returns the template required to render the configuration page.

        >>> plugin.get_conf_template(project)
        """
        if project is not None:
            return self.project_conf_template
        return self.site_conf_template

    def get_conf_options(self, project=None):
        """
        Returns a dict of all of the configured options for a project.

        >>> plugin.get_conf_options(project)
        """
        return default_plugin_options(self, project)

    def get_conf_version(self, project):
        """
        Returns a version string that represents the current configuration state.

        If any option changes or new options added, the version will change.

        >>> plugin.get_conf_version(project)
        """
        options = self.get_conf_options(project)
        return md5_text(
            '&'.join(sorted('%s=%s' % o for o in six.iteritems(options)))
        ).hexdigest()[:3]

    def get_conf_title(self):
        """
        Returns a string representing the title to be shown on the configuration page.
        """
        return self.conf_title or self.get_title()

    def has_site_conf(self):
        return self.site_conf_form is not None

    def has_project_conf(self):
        return self.project_conf_form is not None

    def can_enable_for_projects(self):
        """
        Returns a boolean describing whether this plugin can be enabled for
        projects.
        """
        return True

    def can_configure_for_project(self, project):
        """
        Returns a boolean describing whether this plugin can be enabled on
        a per project basis
        """
        from sentry import features

        if not self.enabled:
            return False
        if not self.can_enable_for_projects():
            return False

        if not features.has('projects:plugins', project, self, actor=None):
            return False

        if not self.can_disable:
            return True

        return True

    def get_form_initial(self, project=None):
        return {}

    # The following methods are specific to web requests

    def get_title(self):
        """
        Returns the general title for this plugin.

        >>> plugin.get_title()
        """
        return self.title

    def get_description(self):
        """
        Returns the description for this plugin. This is shown on the plugin configuration
        page.

        >>> plugin.get_description()
        """
        return self.description

    def get_resource_links(self):
        """
        Returns a list of tuples pointing to various resources for this plugin.

        >>> def get_resource_links(self):
        >>>     return [
        >>>         ('Documentation', 'https://docs.sentry.io'),
        >>>         ('Bug Tracker', 'https://github.com/getsentry/sentry/issues'),
        >>>         ('Source', 'https://github.com/getsentry/sentry'),
        >>>     ]
        """
        return self.resource_links

    def get_view_response(self, request, group):
        from sentry.models import Event

        self.selected = request.path == self.get_url(group)

        if not self.selected:
            return

        response = self.view(request, group)

        if not response:
            return

        if isinstance(response, HttpResponseRedirect):
            return response

        if not isinstance(response, Response):
            raise NotImplementedError('Use self.render() when returning responses.')

        event = group.get_latest_event() or Event()
        event.group = group

        request.access = access.from_request(request, group.organization)

        return response.respond(request, {
            'plugin': self,
            'project': group.project,
            'group': group,
            'event': event,
            'can_admin_event': request.access.has_scope('event:write'),
            'can_remove_event': request.access.has_scope('event:delete'),
        })

    def view(self, request, group, **kwargs):
        """
        Handles the view logic. If no response is given, we continue to the next action provider.

        >>> def view(self, request, group, **kwargs):
        >>>     return self.render('myplugin/about.html')
        """

    def before_events(self, request, group_list, **kwargs):
        """
        Allows preprocessing of groups in the list view.

        This is generally useful if you need to cache lookups
        for something like ``tags`` which would otherwise do
        multiple queries.

        If you use this **at all** you should ensure it's already
        reset on each execution.

        As an example, here's how we might get a reference to ticket ids we were
        storing per event, in an efficient O(1) manner.

        >>> def before_events(self, request, event_list, **kwargs):
        >>>     prefix = self.get_conf_key()
        >>>     GroupMeta.objects.get_value_bulk(event_list, '%s:tid' % prefix)
        """

    def tags(self, request, group, tag_list, **kwargs):
        """
        Modifies the tag list for a grouped message.

        A tag is a string, already marked safe or later escaped, that is shown inline with
        the event.

        This must return ``tag_list``.

        >>> def tags(self, request, group, tag_list, **kwargs):
        >>>     tag_list.append(':(')
        >>>     return tag_list
        """
        return tag_list

    def actions(self, request, group, action_list, **kwargs):
        """
        Modifies the action list for a grouped message.

        An action is a tuple containing two elements:

        ('Action Label', '/uri/to/action/')

        This must return ``action_list``.

        >>> def actions(self, request, group, action_list, **kwargs):
        >>>     action_list.append(('Google', 'http://google.com'))
        >>>     return action_list
        """
        return action_list

    def panels(self, request, group, panel_list, **kwargs):
        """
        Modifies the panel list for a grouped message.

        A panel is a tuple containing two elements:

        ('Panel Label', '/uri/to/panel/')

        This must return ``panel_list``.

        >>> def panels(self, request, group, action_list, **kwargs):
        >>>     panel_list.append((self.get_title(), self.get_url(group)))
        >>>     return panel_list
        """
        return panel_list

    def widget(self, request, group, **kwargs):
        """
        Renders as a widget in the group details sidebar.

        >>> def widget(self, request, group, **kwargs):
        >>>     return self.render('myplugin/widget.html')
        """

    # Server side signals which do not have request context

    def has_perm(self, user, perm, *objects, **kwargs):
        # DEPRECATED: No longer used.
        pass

    def missing_perm_response(self, request, perm, *args, **objects):
        # DEPRECATED: No longer used.
        pass

    def is_regression(self, group, event, **kwargs):
        """
        Called on new events when the group's status is resolved.
        Return True if this event is a regression, False if it is not,
        None to defer to other plugins.

        :param group: an instance of ``Group``
        :param event: an instance of ``Event``

        >>> def is_regression(self, group, event, **kwargs):
        >>>     # regression if 'version' tag has a value we haven't seen before
        >>>     seen_versions = set(t[0] for t in group.get_unique_tags("version"))
        >>>     event_version = dict(event.get_tags()).get("version")
        >>>     return event_version not in seen_versions
        """

    def post_process(self, group, event, is_new, is_sample, **kwargs):
        """
        Post processes an event after it has been saved.

        :param group: an instance of ``Group``
        :param event: an instance of ``Event``
        :param is_new: a boolean describing if this group is new, or has changed state
        :param is_sample: a boolean describing if this event was stored, or sampled

        >>> def post_process(self, event, **kwargs):
        >>>     print 'New event created:', event.id
        >>>     print group.get_absolute_url()
        """

    def get_tags(self, event, **kwargs):
        """
        Return additional tags to add to this instance.

        Tags should be a list of tuples.

        >>> def get_tags(self, event, **kwargs):
        >>>     return [('tag-name', 'tag-value')]
        """

    def get_notification_forms(self, **kwargs):
        """
        Provides additional UserOption forms for the Notification Settings page.

        Must return an iterable.

        >>> def get_notification_forms(self, **kwargs):
        >>>     return [MySettingsForm]
        """
        return []

    def is_testable(self, **kwargs):
        """
        Returns True if this plugin is able to be tested.
        """
        return hasattr(self, 'test_configuration')

    def configure(self, request, project=None):
        """Configures the plugin."""
        return default_plugin_config(self, project, request)

    def get_url_module(self):
        """Allows a plugin to return the import path to a URL module."""

    def view_configure(self, request, project, **kwargs):
        if request.method == 'GET':
            return Response(self.get_configure_plugin_fields(
                request=request,  # DEPRECATED: this param should not be used
                project=project,
                **kwargs
            ))
        self.configure(project, request.DATA)
        return Response({'message': 'Successfully updated configuration.'})


@six.add_metaclass(PluginMount)
class Plugin(IPlugin):
    """
    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.
    """
    __version__ = 1
