from sentry import analytics


@analytics.eventclass("js_sdk_loader.rendered")
class JsSdkLoaderRendered(analytics.Event):
    organization_id: int
    project_id: int
    is_lazy: bool
    has_performance: bool
    has_replay: bool
    has_debug: bool
    has_feedback: bool
    sdk_version: str | None
    tmpl: str


analytics.register(JsSdkLoaderRendered)
