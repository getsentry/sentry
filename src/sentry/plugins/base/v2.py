__all__ = ("Plugin2",)

import logging
from threading import local

from django.http import HttpResponseRedirect

from sentry.plugins import HIDDEN_PLUGINS
from sentry.plugins.base.configuration import default_plugin_config, default_plugin_options
from sentry.plugins.base.response import Response
from sentry.plugins.config import PluginConfigMixin
from sentry.plugins.status import PluginStatusMixin
from sentry.utils.hashlib import md5_text


class PluginMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls = type.__new__(cls, name, bases, attrs)
        if IPlugin2 in bases:
            return new_cls
        if new_cls.title is None:
            new_cls.title = new_cls.__name__
        if not new_cls.slug:
            new_cls.slug = new_cls.title.replace(" ", "-").lower()
        if not hasattr(new_cls, "logger"):
            new_cls.logger = logging.getLogger(f"sentry.plugins.{new_cls.slug}")
        return new_cls


class IPlugin2(local, PluginConfigMixin, PluginStatusMixin):
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
    title = None
    slug = None
    description = None
    version = None
    author = None
    author_url = None
    resource_links = ()
    feature_descriptions = []

    # Configuration specifics
    conf_key = None
    conf_title = None

    project_conf_form = None
    project_conf_template = "sentry/plugins/project_configuration.html"

    # Global enabled state
    enabled = True
    can_disable = True

    # Should this plugin be enabled by default for projects?
    project_default_enabled = False

    # used by queries to determine if the plugin is configured
    required_field = None

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
        return md5_text("&".join(sorted("%s=%s" % o for o in options.items()))).hexdigest()[:3]

    def get_conf_title(self):
        """
        Returns a string representing the title to be shown on the configuration page.
        """
        return self.conf_title or self.get_title()

    def get_form_initial(self, project=None):
        return {}

    def has_project_conf(self):
        return self.project_conf_form is not None

    def has_plugin_conf(self):
        """
        Checks if the plugin should be returned in the ProjectPluginsEndpoint
        """
        return self.has_project_conf()

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
        context["plugin"] = self
        return Response(template, context)

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

    def get_resource_links(self):
        """
        Returns a list of tuples pointing to various resources for this plugin.

        >>> def get_resource_links(self):
        >>>     return [
        >>>         ('Documentation', 'https://docs.sentry.io'),
        >>>         ('Report Issue', 'https://github.com/getsentry/sentry/issues'),
        >>>         ('View Source', 'https://github.com/getsentry/sentry'),
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

    def get_annotations(self, group, **kwargs):
        """
        Return a list of annotations to append to this aggregate.

        An example of an annotation might be "Needs Fix" or "Task #123".

        The properties of each tag must match the constructor for
        :class:`sentry.plugins.Annotation`

        >>> def get_annotations(self, group, **kwargs):
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

    def get_event_preprocessors(self, data, **kwargs):
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

    def get_event_enhancers(self, data, **kwargs):
        """
        Return a list of enhancers to apply to the given event.

        An enhancer is a function that takes the normalized data blob as an
        input and returns modified data as output. If no changes to the data are
        made it is safe to return ``None``.

        As opposed to event (pre)processors, enhancers run **before** stacktrace
        processing and can be used to perform more extensive event normalization
        or add additional data before stackframes are symbolicated.

        Enhancers should not be returned if there is nothing to do with the
        event data.

        >>> def get_event_enhancers(self, data, **kwargs):
        >>>     return [lambda x: x]
        """
        return []

    def get_feature_hooks(self, **kwargs):
        """
        Return a list of callables to check for feature status.

        >>> from sentry.features import FeatureHandler
        >>>
        >>> class NoRegistration(FeatureHandler):
        >>>     features = set(['auth:register'])
        >>>
        >>>     def has(self, feature, actor):
        >>>         return False

        >>> def get_feature_hooks(self, **kwargs):
        >>>     return [NoRegistration()]
        """
        return []

    def get_release_hook(self, **kwargs):
        """
        Return an implementation of ``ReleaseHook``.

        >>> from sentry.plugins.interfaces.releasehook import ReleaseHook
        >>>
        >>> class MyReleaseHook(ReleaseHook):
        >>>     def handle(self, request):
        >>>         self.finish_release(version=request.POST['version'])

        >>> def get_release_hook(self, **kwargs):
        >>>     return MyReleaseHook
        """
        return []

    def get_custom_contexts(self):
        """Return a list of of context types.

        from sentry.interfaces.contexts import ContextType

        class MyContextType(ContextType):
            type = 'my_type'

        def get_custom_contexts(self):
            return [MyContextType]
        """

    def configure(self, project, request):
        """Configures the plugin."""
        return default_plugin_config(self, project, request)

    def get_url_module(self):
        """Allows a plugin to return the import path to a URL module."""

    def handle_signal(self, name, payload, **kwargs):
        pass


class Plugin2(IPlugin2, metaclass=PluginMount):
    """
    A plugin should be treated as if it were a singleton. The owner does not
    control when or how the plugin gets instantiated, nor is it guaranteed that
    it will happen, or happen more than once.
    """

    __version__ = 2
