from sentry import analytics


@analytics.eventclass("devtoolbar.api_request")
class DevToolbarApiRequestEvent(analytics.Event):
    view_name: str
    route: str
    query_string: str | None = None
    origin: str | None = None
    method: str | None
    status_code: int
    organization_id: int | None = None
    organization_slug: str | None = None
    project_id: int | None = None
    project_slug: str | None = None
    user_id: int | None = None


analytics.register(DevToolbarApiRequestEvent)
