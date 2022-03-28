from __future__ import annotations

import inspect

from pkg_resources import iter_entry_points

from sentry.plugins.base import plugins

from ..base import TestCase


class PluginTestCase(TestCase):
    plugin = None

    def setUp(self):
        super().setUp()

        # Old plugins, plugin is a class, new plugins, it's an instance
        # New plugins don't need to be registered
        if inspect.isclass(self.plugin):
            plugins.register(self.plugin)
            self.addCleanup(plugins.unregister, self.plugin)

    def assertAppInstalled(self, name, path):
        for ep in iter_entry_points("sentry.apps"):
            if ep.name == name:
                ep_path = ep.module_name
                if ep_path == path:
                    return
                self.fail(
                    "Found app in entry_points, but wrong class. Got %r, expected %r"
                    % (ep_path, path)
                )
        self.fail(f"Missing app from entry_points: {name!r}")

    def assertPluginInstalled(self, name, plugin):
        path = type(plugin).__module__ + ":" + type(plugin).__name__
        for ep in iter_entry_points("sentry.plugins"):
            if ep.name == name:
                ep_path = ep.module_name + ":" + ".".join(ep.attrs)
                if ep_path == path:
                    return
                self.fail(
                    "Found plugin in entry_points, but wrong class. Got %r, expected %r"
                    % (ep_path, path)
                )
        self.fail(f"Missing plugin from entry_points: {name!r}")
