"""
sentry.plugins.base.v2
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

__all__ = ('Plugin2',)

import logging

from django.http import HttpResponseRedirect
from threading import local

from sentry.plugins.base.response import Response


class PluginMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls = type.__new__(cls, name, bases, attrs)
        if IPlugin2 in bases:
            return new_cls
        if not new_cls.title:
            new_cls.title = new_cls.__name__
        if not new_cls.slug:
            new_cls.slug = new_cls.title.replace(' ', '-').lower()
        if not hasattr(new_cls, 'logger'):
            new_cls.logger = logging.getLogger('sentry.plugins.%s' % (new_cls.slug,))
        return new_cls


class IPlugin2(local):
    """
    Plugin interface. Should not be inherited from directly.

    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.

    >>> from sentry.plugins import Plugin2
    >>>
    >>> class MyPlugin(Plugin2):
    >>>     def get_title(self):
    >>>         return 'My Plugin'

    As a general rule all inherited methods should allow ``**kwargs`` to ensure
    ease of future compatibility.
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

    # Global enabled state
    enabled = True
    can_disable = True

    # Should this plugin be enabled by default for projects?
    project_default_enabled = False

    def _get_option_key(self, key):
        return '%s:%s' % (self.get_conf_key(), key)

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
        from .helpers import reset_options
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

    def get_conf_key(self):
        """
        Returns a string representing the configuration keyspace prefix for this plugin.
        """
        if not self.conf_key:
            return self.get_conf_title().lower().replace(' ', '_')
        return self.conf_key

    def get_conf_title(self):
        """
        Returns a string representing the title to be shown on the configuration page.
        """
        return self.conf_title or self.get_title()

    def has_project_conf(self):
        return self.project_conf_form is not None

    def can_enable_for_projects(self):
        """
        Returns a boolean describing whether this plugin can be enabled on a per project basis
        """
        return True

    # Response methods

    def redirect(self, url):
        """
        Returns a redirect response type.
        """
        return HttpResponseRedirect(url)

    def render(self, template, context=None):
        """
        Given a template name, and an optional context (dictionary), returns a
        ready-to-render response.

        Default context includes the plugin instance.

        >>> plugin.render('template.html', {'hello': 'world'})
        """
        if context is None:
            context = {}
        context['plugin'] = self
        return Response(template, context)

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
        >>>         ('Documentation', 'http://sentry.readthedocs.org'),
        >>>         ('Bug Tracker', 'https://github.com/getsentry/sentry/issues'),
        >>>         ('Source', 'https://github.com/getsentry/sentry'),
        >>>     ]
        """
        return self.resource_links

    def get_rules(self, **kwargs):
        """
        Return a list of Rule classes to add to the registry.

        >>> def get_rules(self, **kwargs):
        >>>     return [MyCustomRule]
        """
        return []

    def get_actions(self, request, group, **kwargs):
        """
        Return a list of available actions to append this aggregate.

        Examples of built-in actions are "Mute Event" and "Remove Data".

        An action is a tuple containing two elements:

            ('Action Label', '/uri/to/action/')

        >>> def get_actions(self, request, group, **kwargs):
        >>>     return [('Google', 'http://google.com')]
        """
        return []

    def get_annotations(self, request, group, **kwargs):
        """
        Return a list of annotations to append to this aggregate.

        An example of an annotation might be "Needs Fix" or "Task #123".

        The properties of each tag must match the constructor for
        :class:`sentry.plugins.Annotation`

        >>> def get_annotations(self, request, group, **kwargs):
        >>>     task_id = GroupMeta.objects.get_value(group, 'myplugin:tid')
        >>>     if not task_id:
        >>>         return []
        >>>     return [{'label': '#%s' % (task_id,)}]
        """
        return []

    def get_notifiers(self, **kwargs):
        """
        Return a list of notifiers to append to the registry.

        Notifiers must extend :class:`sentry.plugins.Notifier`.

        >>> def get_notifiers(self, **kwargs):
        >>>     return [MyNotifier]
        """
        return []

    def get_tags(self, event, **kwargs):
        """
        Return a list of additional tags to add to this instance.

        A tag is a tuple containing two elements:

            ('tag-key', 'tag-value')

        >>> def get_tags(self, event, **kwargs):
        >>>     return [('tag-key', 'tag-value')]
        """
        return []

    def get_event_preprocessors(self, **kwargs):
        """
        Return a list of preprocessors to apply to the given event.

        A preprocessor is a function that takes the normalized data blob as an
        input and returns modified data as output. If no changes to the data are
        made it is safe to return ``None``.

        >>> def get_event_preprocessors(self, **kwargs):
        >>>     return [lambda x: x]
        """
        return []


class Plugin2(IPlugin2):
    """
    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.
    """
    __version__ = 2
    __metaclass__ = PluginMount
