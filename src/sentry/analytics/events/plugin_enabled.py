from sentry import analytics


@analytics.eventclass("plugin.enabled")
class PluginEnabledEvent(analytics.Event):
    user_id: int | None
    organization_id: str
    project_id: str
    plugin: str


analytics.register(PluginEnabledEvent)
