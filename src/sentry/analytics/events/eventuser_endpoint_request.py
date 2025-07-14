from sentry import analytics


@analytics.eventclass("eventuser_endpoint.request")
class EventUserEndpointRequest(analytics.Event):
    endpoint: str
    project_id: int | None = None


analytics.register(EventUserEndpointRequest)
