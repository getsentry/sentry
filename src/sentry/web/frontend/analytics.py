from sentry import analytics


@analytics.eventclass("js_sdk_loader.rendered")
class JsSdkLoaderRendered(analytics.Event):
    organization_id: str
    project_id: str
    is_lazy: str
    has_performance: str
    has_replay: str
    has_debug: str
    sdk_version: str
    tmpl: str


analytics.register(JsSdkLoaderRendered)
