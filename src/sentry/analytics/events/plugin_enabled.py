from __future__ import absolute_import

from sentry import analytics


class PluginEnabledEvent(analytics.Event):
    type = "plugin.enabled"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("plugin"),
    )


analytics.register(PluginEnabledEvent)
