from __future__ import annotations

import logging
from collections.abc import Sequence
from threading import local
from typing import TYPE_CHECKING, Any

from django.http import HttpResponseRedirect
from django.urls import reverse

from sentry.auth import access
from sentry.models.project import Project
from sentry.plugins import HIDDEN_PLUGINS
from sentry.plugins.base.response import DeferredResponse
from sentry.plugins.base.view import PluggableViewMixin
from sentry.plugins.config import PluginConfigMixin
from sentry.projects.services.project import RpcProject

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise

__all__ = ("Plugin",)


class PluginMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls: type[IPlugin] = type.__new__(cls, name, bases, attrs)  # type: ignore[assignment]
        if IPlugin in bases:
            return new_cls
        if not hasattr(new_cls, "title"):
            new_cls.title = new_cls.__name__
        if not hasattr(new_cls, "slug"):
            new_cls.slug = new_cls.title.replace(" ", "-").lower()
        if "logger" not in attrs:
            new_cls.logger = logging.getLogger(f"sentry.plugins.{new_cls.slug}")
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
    title: str | _StrPromise
    slug: str
    description: str | None = None
    version: str | None = None
    author: str | None = None
    author_url: str | None = None
    resource_links: list[tuple[str, str]] = []
    feature_descriptions: Sequence[Any] = []

    # Configuration specifics
    conf_key: str | None = None
    conf_title: str | _StrPromise | None = None

    project_conf_form: Any = None

    # Global enabled state
    enabled = True
    can_disable = True

    # Should this plugin be enabled by default for projects?
    project_default_enabled = False

    # used by queries to determine if the plugin is configured
    required_field: str | None = None

    def _get_option_key(self, key):
        return f"{self.get_conf_key()}:{key}"

    def get_plugin_type(self):
        return "default"

    def is_enabled(self, project: Project | RpcProject | None = None):
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
            project_enabled = self.get_option("enabled", project)
            if project_enabled is not None:
                return project_enabled
            else:
                return self.project_default_enabled

        return True

    def reset_options(self, project=None):
        from sentry.plugins.helpers import reset_options

        return reset_options(self.get_conf_key(), project)

    def get_option(self, key, project=None, user=None):
        """
        Returns the value of an option in your plugins keyspace, or ``None`` if
        one is not present.

        If ``project`` is passed, it will limit the scope to that project's keyspace.

        >>> value = plugin.get_option('my_option')
        """
        from sentry.plugins.helpers import get_option

        return get_option(self._get_option_key(key), project, user)

    def set_option(self, key, value, project=None, user=None) -> None:
        """
        Updates the value of an option in your plugins keyspace.

        If ``project`` is passed, it will limit the scope to that project's keyspace.

        >>> plugin.set_option('my_option', 'http://example.com')
        """
        from sentry.plugins.helpers import set_option

        set_option(self._get_option_key(key), value, project, user)

    def unset_option(self, key, project=None, user=None) -> None:
        """
        Removes an option in your plugins keyspace.

        If ``project`` is passed, it will limit the scope to that project's keyspace.

        >>> plugin.unset_option('my_option')
        """
        from sentry.plugins.helpers import unset_option

        unset_option(self._get_option_key(key), project, user)

    def enable(self, project=None, user=None):
        """Enable the plugin."""
        self.set_option("enabled", True, project, user)

    def disable(self, project=None, user=None):
        """Disable the plugin."""
        self.set_option("enabled", False, project, user)

    def get_url(self, group):
        """
        Returns the absolute URL to this plugins group action handler.

        >>> plugin.get_url(group)
        """
        return reverse(
            "sentry-group-plugin-action",
            args=(group.organization.slug, group.project.slug, group.pk, self.slug),
        )

    def get_conf_key(self):
        """
        Returns a string representing the configuration keyspace prefix for this plugin.
        """
        if not self.conf_key:
            return self.get_conf_title().lower().replace(" ", "_")
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

        if not features.has("projects:plugins", project, self, actor=None):
            return False

        if not self.can_disable:
            return True

        return True

    # The following methods are specific to web requests

    def get_title(self) -> str | _StrPromise:
        """
        Returns the general title for this plugin.

        >>> plugin.get_title()
        """
        return self.title

    get_short_title = get_title

    def get_description(self) -> str | None:
        """
        Returns the description for this plugin. This is shown on the plugin configuration
        page.

        >>> plugin.get_description()
        """
        return self.description

    def get_view_response(self, request, group):
        self.selected = request.path == self.get_url(group)

        if not self.selected:
            return

        response = self.view(request, group)

        if not response:
            return

        if isinstance(response, HttpResponseRedirect):
            return response

        if not isinstance(response, DeferredResponse):
            raise NotImplementedError("Use self.render() when returning responses.")

        event = group.get_latest_event()
        if event:
            event.group = group

        request.access = access.from_request(request, group.organization)

        return response.respond(
            request,
            {
                "plugin": self,
                "project": group.project,
                "group": group,
                "event": event,
                "can_admin_event": request.access.has_scope("event:write"),
                "can_remove_event": request.access.has_scope("event:admin"),
            },
        )

    def view(self, request, group, **kwargs):
        """
        Handles the view logic. If no response is given, we continue to the next action provider.

        >>> def view(self, request, group, **kwargs):
        >>>     return self.render('myplugin/about.html')
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

    def actions(self, group, action_list, **kwargs):
        """
        Modifies the action list for a grouped message.

        An action is a tuple containing two elements:

        ('Action Label', '/uri/to/action/')

        This must return ``action_list``.

        >>> def actions(self, group, action_list, **kwargs):
        >>>     action_list.append(('Google', 'http://google.com'))
        >>>     return action_list
        """
        return action_list

    def widget(self, request, group, **kwargs):
        """
        Renders as a widget in the group details sidebar.

        >>> def widget(self, request, group, **kwargs):
        >>>     return self.render('myplugin/widget.html')
        """

    # Server side signals which do not have request context

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
        >>>     event_version = dict(event.tags).get("version")
        >>>     return event_version not in seen_versions
        """

    def post_process(self, *, group, event, is_new, **kwargs) -> None:
        """
        Post processes an event after it has been saved.

        :param group: an instance of ``Group``
        :param event: an instance of ``Event``
        :param is_new: a boolean describing if this group is new, or has changed state

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

    def is_testable(self, **kwargs):
        """
        Returns True if this plugin is able to be tested.
        """
        return hasattr(self, "test_configuration")

    def is_hidden(self):
        """
        Should this plugin be hidden in the UI

        We use this to hide plugins as they are replaced with integrations.
        """
        return self.slug in HIDDEN_PLUGINS

    def get_url_module(self):
        """Allows a plugin to return the import path to a URL module."""


class Plugin(IPlugin, metaclass=PluginMount):
    """
    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.
    """

    __version__ = 1
