from sentry import analytics


@analytics.eventclass("eventuser_endpoint.request")
class EventUserEndpointRequest(analytics.Event):
    endpoint: str
    project_id: str | None = None


analytics.register(EventUserEndpointRequest)
