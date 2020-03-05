from __future__ import absolute_import, print_function

__all__ = ("PluginManager",)

import logging

from sentry.utils.managers import InstanceManager
from sentry.utils.safe import safe_execute


class PluginManager(InstanceManager):
    def __iter__(self):
        return iter(self.all())

    def __len__(self):
        return sum(1 for i in self.all())

    def all(self, version=1):
        for plugin in sorted(super(PluginManager, self).all(), key=lambda x: x.get_title()):
            if not plugin.is_enabled():
                continue
            if version is not None and plugin.__version__ != version:
                continue
            yield plugin

    def plugin_that_can_be_configured(self):
        for plugin in self.all(version=None):
            if plugin.has_project_conf():
                yield plugin

    def configurable_for_project(self, project, version=1):
        for plugin in self.all(version=version):
            if not safe_execute(plugin.can_configure_for_project, project, _with_transaction=False):
                continue
            yield plugin

    def exists(self, slug):
        for plugin in self.all(version=None):
            if plugin.slug == slug:
                return True
        return False

    def for_project(self, project, version=1):
        for plugin in self.all(version=version):
            if not safe_execute(plugin.is_enabled, project, _with_transaction=False):
                continue
            yield plugin

    def for_site(self, version=1):
        for plugin in self.all(version=version):
            if not plugin.has_site_conf():
                continue
            yield plugin

    def get(self, slug):
        for plugin in self.all(version=None):
            if plugin.slug == slug:
                return plugin
        raise KeyError(slug)

    def first(self, func_name, *args, **kwargs):
        version = kwargs.pop("version", 1)
        for plugin in self.all(version=version):
            try:
                result = getattr(plugin, func_name)(*args, **kwargs)
            except Exception as e:
                logger = logging.getLogger("sentry.plugins.%s" % (type(plugin).slug,))
                logger.error("%s.process_error", func_name, exc_info=True, extra={"exception": e})
                continue

            if result is not None:
                return result

    def register(self, cls):
        self.add("%s.%s" % (cls.__module__, cls.__name__))
        return cls

    def unregister(self, cls):
        self.remove("%s.%s" % (cls.__module__, cls.__name__))
        return cls
