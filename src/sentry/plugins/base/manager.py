from __future__ import annotations

import logging
from collections.abc import Generator, Iterator
from typing import TYPE_CHECKING, Literal, overload

from sentry.utils.managers import InstanceManager
from sentry.utils.safe import safe_execute

if TYPE_CHECKING:
    from sentry.plugins.base.v1 import Plugin
    from sentry.plugins.base.v2 import Plugin2

__all__ = ("PluginManager",)


class PluginManager(InstanceManager):
    def __iter__(self) -> Iterator[Plugin | Plugin2]:
        return iter(self.all())

    def __len__(self) -> int:
        return sum(1 for i in self.all())

    @overload
    def all(self) -> Generator[Plugin]: ...

    @overload
    def all(self, *, version: Literal[2]) -> Generator[Plugin2]: ...

    @overload
    def all(self, *, version: None) -> Generator[Plugin | Plugin2]: ...

    def all(self, version: int | None = 1) -> Generator[Plugin | Plugin2]:
        for plugin in sorted(super().all(), key=lambda x: x.get_title()):
            if not plugin.is_enabled():
                continue
            if version is not None and plugin.__version__ != version:
                continue
            yield plugin

    def plugin_that_can_be_configured(self) -> Generator[Plugin | Plugin2]:
        for plugin in self.all(version=None):
            if plugin.has_project_conf():
                yield plugin

    def configurable_for_project(self, project, version=1):
        for plugin in self.all(version=version):
            if not safe_execute(plugin.can_configure_for_project, project):
                continue
            yield plugin

    def exists(self, slug: str) -> bool:
        for plugin in self.all(version=None):
            if plugin.slug == slug:
                return True
        return False

    def for_project(self, project, version=1):
        for plugin in self.all(version=version):
            if not safe_execute(plugin.is_enabled, project):
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
                logger = logging.getLogger(f"sentry.plugins.{type(plugin).slug}")
                logger.exception("%s.process_error", func_name, extra={"exception": e})
                continue

            if result is not None:
                return result

    def register(self, cls):
        self.add(f"{cls.__module__}.{cls.__name__}")
        return cls

    def unregister(self, cls):
        self.remove(f"{cls.__module__}.{cls.__name__}")
        return cls
