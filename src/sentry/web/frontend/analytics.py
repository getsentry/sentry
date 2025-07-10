from packaging.version import Version

from sentry import analytics
from sentry.analytics import Event, eventclass


@eventclass("js_sdk_loader.rendered")
class JsSdkLoaderRendered(Event):
    organization_id: int
    project_id: int
    is_lazy: bool
    has_performance: bool
    has_replay: bool
    has_debug: bool
    sdk_version: Version | None
    tmpl: str


analytics.register(JsSdkLoaderRendered)
