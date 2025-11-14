from typing import int
from sentry import analytics


@analytics.eventclass("plugin.enabled")
class PluginEnabledEvent(analytics.Event):
    user_id: int | None
    organization_id: int
    project_id: int
    plugin: str


analytics.register(PluginEnabledEvent)
