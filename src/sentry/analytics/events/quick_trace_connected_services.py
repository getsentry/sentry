from sentry import analytics


class QuickTraceConnectedServices(analytics.Event):
    type = "quick_trace.connected_services"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("projects"),
    )


analytics.register(QuickTraceConnectedServices)
