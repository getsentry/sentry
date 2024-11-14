from sentry import analytics


class EventUserEndpointRequest(analytics.Event):
    type = "eventuser_endpoint.request"

    attributes = (
        analytics.Attribute("endpoint", required=True),
        analytics.Attribute("project_id", required=False),
    )


analytics.register(EventUserEndpointRequest)
