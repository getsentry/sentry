from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from threading import local
from typing import TYPE_CHECKING, Any, Protocol

from django.http import HttpResponseRedirect

from sentry.plugins import HIDDEN_PLUGINS
from sentry.plugins.base.response import DeferredResponse
from sentry.plugins.config import PluginConfigMixin
from sentry.plugins.interfaces.releasehook import ReleaseHook

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise


class EventPreprocessor(Protocol):
    def __call__(self, data: MutableMapping[str, Any]) -> MutableMapping[str, Any] | None: ...


class PluginMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls: type[IPlugin2] = type.__new__(cls, name, bases, attrs)  # type: ignore[assignment]
        if IPlugin2 in bases:
            return new_cls
        if not hasattr(new_cls, "title"):
            new_cls.title = new_cls.__name__
        if not hasattr(new_cls, "slug"):
            new_cls.slug = new_cls.title.replace(" ", "-").lower()
        if not hasattr(new_cls, "logger"):
            new_cls.logger = logging.getLogger(f"sentry.plugins.{new_cls.slug}")
        return new_cls


class IPlugin2(local, PluginConfigMixin):
    """
    Plugin interface. Should not be inherited from directly.

    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.

    >>> from sentry.plugins.base.v2 import Plugin2
    >>>
    >>> class MyPlugin(Plugin2):
    >>>     def get_title(self):
    >>>         return 'My Plugin'

    As a general rule all inherited methods should allow ``**kwargs`` to ensure
    ease of future compatibility.
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

        if project:
            project_enabled = self.get_option("enabled", project)
            if project_enabled is not None:
                return project_enabled
            else:
                return self.project_default_enabled

        return True

    def is_hidden(self):
        """
        Should this plugin be hidden in the UI

        We use this to hide plugins as they are replaced with integrations.
        """
        return self.slug in HIDDEN_PLUGINS

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

    def get_conf_key(self):
        """
        Returns a string representing the configuration keyspace prefix for this plugin.
        """
        if not self.conf_key:
            self.conf_key = self.get_conf_title().lower().replace(" ", "_")
        return self.conf_key

    def get_conf_title(self):
        """
        Returns a string representing the title to be shown on the configuration page.
        """
        return self.conf_title or self.get_title()

    def has_project_conf(self):
        return self.project_conf_form is not None

    def can_configure_for_project(self, project):
        """
        Checks if the plugin can be configured for a specific project.
        """
        from sentry import features

        if not self.enabled:
            return False

        if not features.has("projects:plugins", project, self, actor=None):
            return False

        if not self.can_disable:
            return True

        return True

    # Response methods

    def redirect(self, url: str) -> HttpResponseRedirect:
        """
        Returns a redirect response type.
        """
        return HttpResponseRedirect(url)

    def render(self, template: str, context: dict[str, Any] | None = None) -> DeferredResponse:
        """
        Given a template name, and an optional context (dictionary), returns a
        ready-to-render response.

        Default context includes the plugin instance.

        >>> plugin.render('template.html', {'hello': 'world'})
        """
        if context is None:
            context = {}
        context["plugin"] = self
        return DeferredResponse(template, context)

    # The following methods are specific to web requests

    def get_title(self):
        """
        Returns the general title for this plugin.

        >>> plugin.get_title()
        """
        return self.title

    get_short_title = get_title

    def get_description(self):
        """
        Returns the description for this plugin. This is shown on the plugin configuration
        page.

        >>> plugin.get_description()
        """
        return self.description

    def get_rules(self, **kwargs):
        """
        Return a list of Rule classes to add to the registry.

        >>> def get_rules(self, **kwargs):
        >>>     return [MyCustomRule]
        """
        return []

    def get_actions(self, request, group) -> list[tuple[str, str]]:
        """
        Return a list of available actions to append this aggregate.

        Examples of built-in actions are "Mute Event" and "Remove Data".

        An action is a tuple containing two elements:

            ('Action Label', '/uri/to/action/')

        >>> def get_actions(self, request, group):
        >>>     return [('Google', 'http://google.com')]
        """
        return []

    def get_annotations(self, group) -> list[dict[str, str]]:
        """
        Return a list of annotations to append to this aggregate.

        An example of an annotation might be "Needs Fix" or "Task #123".

        The properties of each tag must match the constructor for
        :class:`sentry.plugins.Annotation`

        >>> def get_annotations(self, group):
        >>>     task_id = GroupMeta.objects.get_value(group, 'myplugin:tid')
        >>>     if not task_id:
        >>>         return []
        >>>     return [{'label': '#%s' % (task_id,)}]
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

    def get_event_preprocessors(self, data: Mapping[str, Any]) -> Sequence[EventPreprocessor]:
        """
        Return a list of preprocessors to apply to the given event.

        A preprocessor is a function that takes the normalized data blob as an
        input and returns modified data as output. If no changes to the data are
        made it is safe to return ``None``.

        Preprocessors should not be returned if there is nothing to
        do with the event data.

        >>> def get_event_preprocessors(self, data, **kwargs):
        >>>     return [lambda x: x]
        """
        return []

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        """
        This works similarly to `get_event_preprocessors` but returns a
        function that is invoked for all encountered stacktraces in an
        event.

        Preprocessors should not be returned if there is nothing to
        do with the event data.

        :::

            def get_stacktrace_processors(self, data, stacktrace_infos,
                                          platforms, **kwargs):
                if 'cocoa' in platforms:
                    return [CocoaProcessor(data, stacktrace_infos)]
        """

    def get_release_hook(self) -> type[ReleaseHook] | None:
        """
        Return an implementation of ``ReleaseHook``.

        >>> from sentry.plugins.interfaces.releasehook import ReleaseHook
        >>>
        >>> class MyReleaseHook(ReleaseHook):
        >>>     def handle(self, request: Request) -> Response:
        >>>         self.finish_release(version=request.POST['version'])

        >>> def get_release_hook(self):
        >>>     return MyReleaseHook
        """
        return None

    def get_custom_contexts(self):
        """Return a list of of context types.

        from sentry.interfaces.contexts import ContextType

        class MyContextType(ContextType):
            type = 'my_type'

        def get_custom_contexts(self):
            return [MyContextType]
        """

    def get_url_module(self):
        """Allows a plugin to return the import path to a URL module."""


class Plugin2(IPlugin2, metaclass=PluginMount):
    """
    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.
    """

    __version__ = 2


__all__ = ("Plugin2",)
