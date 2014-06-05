"""
sentry.plugins.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

__all__ = ('Plugin', 'RateLimitingMixin', 'plugins', 'register', 'unregister')

import logging

from django.conf import settings
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, HttpResponse

from nydus.db import create_cluster
from threading import local
from time import time

from sentry.quotas.base import RateLimited, NotRateLimited
from sentry.utils.managers import InstanceManager
from sentry.utils.safe import safe_execute


class Response(object):
    def __init__(self, template, context=None):
        self.template = template
        self.context = context

    def respond(self, request, context=None):
        return HttpResponse(self.render(request, context))

    def render(self, request, context=None):
        from sentry.web.helpers import render_to_string

        if not context:
            context = {}

        if self.context:
            context.update(self.context)

        context.update(csrf(request))

        return render_to_string(self.template, context, request)


class PluginManager(InstanceManager):
    def __iter__(self):
        return iter(self.all())

    def __len__(self):
        return sum(1 for i in self.all())

    def all(self):
        for plugin in sorted(super(PluginManager, self).all(), key=lambda x: x.get_title()):
            if not plugin.is_enabled():
                continue
            yield plugin

    def for_project(self, project):
        for plugin in self.all():
            if not safe_execute(plugin.is_enabled, project):
                continue
            yield plugin

    def for_site(self):
        for plugin in self.all():
            if not plugin.has_site_conf():
                continue
            yield plugin

    def get(self, slug):
        for plugin in self.all():
            if plugin.slug == slug:
                return plugin
        raise KeyError(slug)

    def first(self, func_name, *args, **kwargs):
        for plugin in self.all():
            try:
                result = getattr(plugin, func_name)(*args, **kwargs)
            except Exception as e:
                logger = logging.getLogger('sentry.plugins')
                logger.error('Error processing %s() on %r: %s', func_name, plugin.__class__, e, extra={
                    'func_arg': args,
                    'func_kwargs': kwargs,
                }, exc_info=True)
                continue

            if result is not None:
                return result

    def register(self, cls):
        self.add('%s.%s' % (cls.__module__, cls.__name__))
        return cls

    def unregister(self, cls):
        self.remove('%s.%s' % (cls.__module__, cls.__name__))
        return cls

plugins = PluginManager()
register = plugins.register
unregister = plugins.unregister


class PluginMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls = type.__new__(cls, name, bases, attrs)
        if IPlugin in bases:
            return new_cls
        if not new_cls.title:
            new_cls.title = new_cls.__name__
        if not new_cls.slug:
            new_cls.slug = new_cls.title.replace(' ', '-').lower()
        return new_cls


class IPlugin(local):
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
        from .helpers import get_option
        return get_option(self._get_option_key(key), project, user)

    def set_option(self, key, value, project=None, user=None):
        """
        Updates the value of an option in your plugins keyspace.

        If ``project`` is passed, it will limit the scope to that project's keyspace.

        >>> plugin.set_option('my_option', 'http://example.com')
        """
        from .helpers import set_option
        return set_option(self._get_option_key(key), value, project, user)

    def unset_option(self, key, project=None, user=None):
        """
        Removes an option in your plugins keyspace.

        If ``project`` is passed, it will limit the scope to that project's keyspace.

        >>> plugin.unset_option('my_option')
        """
        from .helpers import unset_option
        return unset_option(self._get_option_key(key), project, user)

    def get_url(self, group):
        """
        Returns the absolute URL to this plugins group action handler.

        >>> plugin.get_url(group)
        """
        return reverse('sentry-group-plugin-action', args=(group.team.slug, group.project.slug, group.pk, self.slug))

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

    def has_site_conf(self):
        return self.site_conf_form is not None

    def has_project_conf(self):
        return self.project_conf_form is not None

    def can_enable_for_projects(self):
        """
        Returns a boolean describing whether this plugin can be enabled on a per project basis
        """
        return True

    def get_form_initial(self, project=None):
        return {}

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

    def get_view_response(self, request, group):
        from sentry.models import Event
        from sentry.permissions import can_admin_group

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

        return response.respond(request, {
            'plugin': self,
            'project': group.project,
            'group': group,
            'event': event,
            'can_admin_event': can_admin_group(request.user, group),
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
        """
        Given a user, a permission name, and an optional list of objects
        within context, returns an override value for a permission.

        :param user: either an instance of ``AnonymousUser`` or ``User``.
        :param perm: a string, such as "edit_project"
        :param objects: an optional list of objects

        If your plugin does not modify this permission, simply return ``None``.

        For example, has perm might be called like so:

        >>> has_perm(user, 'add_project')

        It also might be called with more context:

        >>> has_perm(user, 'edit_project', project)

        Or with even more context:

        >>> has_perm(user, 'configure_project_plugin', project, plugin)
        """
        return None

    def missing_perm_response(self, request, perm, *args, **objects):
        """
        Given a user, a permission name, and an optional mapping of objects
        within a context, returns a custom response.

        :param user: either an instance of ``AnonymousUser`` or ``User``.
        :param perm: a string, such as "edit_project"
        :param objects: an optional mapping of objects

        If your plugin does not need to override this response, simply return
        ``None``.
        """

    def on_alert(self, alert, **kwargs):
        """
        Called when a new alert is generated.

        :param alert: an instance of ``Alert``

        >>> def on_alert(self, alert, **kwargs):
        >>>     print 'New alert!', alert.message
        >>>     print alert.get_absolute_url()
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


class Plugin(IPlugin):
    """
    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.
    """
    __metaclass__ = PluginMount


class RateLimitingMixin(object):
    """
    A mixin that provides rate limiting capabilities with Redis.
    """
    ttl = 60

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS
        options.setdefault('hosts', {0: {}})
        options.setdefault('router', 'nydus.db.routers.keyvalue.PartitionRouter')
        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': options['router'],
            'hosts': options['hosts'],
        })

    def is_rate_limited(self, project):
        proj_quota = self.get_project_quota(project)
        if project.team:
            team_quota = self.get_team_quota(project.team)
        else:
            team_quota = 0
        system_quota = self.get_system_quota()

        if not (proj_quota or system_quota or team_quota):
            return NotRateLimited

        sys_result, team_result, proj_result = self._incr_project(project)

        if proj_quota and proj_result > proj_quota:
            return RateLimited(retry_after=self.get_time_remaining())

        if team_quota and team_result > team_quota:
            return RateLimited(retry_after=self.get_time_remaining())

        if system_quota and sys_result > system_quota:
            return RateLimited(retry_after=self.get_time_remaining())

        return NotRateLimited

    def get_system_key(self):
        """
        Implement to provide system-wide rate limits
        """
        raise NotImplementedError

    def get_system_quota(self):
        """
        Number of events system-wide per minute.
        0 means no rate limits applied.
        """
        return 0

    def get_project_key(self, project):
        """
        Implement to provide project-wide rate limits
        """
        raise NotImplementedError

    def get_project_quota(self, project):
        """
        Number of events per project per minute
        0 means no rate limits applied.
        """
        return 0

    def get_team_key(self, team):
        """
        Implement to provide team-wide rate limits
        """
        raise NotImplementedError

    def get_team_quota(self, team):
        """
        Number of events per minute per team
        0 means no rate limits applied.
        """
        return 0

    def get_time_remaining(self):
        return int(self.ttl - (time() - int(time() / self.ttl) * self.ttl))

    def _incr_project(self, project):
        if project.team:
            try:
                team_key = self.get_team_key(project.team)
            except NotImplementedError:
                team_key = None
                team_result = 0
        else:
            team_key = None
            team_result = 0

        try:
            proj_key = self.get_project_key(project)
        except NotImplementedError:
            proj_key = None
            proj_result = 0

        try:
            sys_key = self.get_system_key()
        except NotImplementedError:
            sys_key = None
            sys_result = 0

        with self.conn.map() as conn:
            if proj_key:
                proj_result = conn.incr(proj_key)
                conn.expire(proj_key, self.ttl)

            if sys_key:
                sys_result = conn.incr(sys_key)
                conn.expire(sys_key, self.ttl)

            if team_key:
                team_result = conn.incr(team_key)
                conn.expire(team_key, self.ttl)

        return int(sys_result), int(team_result), int(proj_result)
