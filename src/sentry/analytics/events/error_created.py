from sentry import analytics


class ErrorCreatedEvent(analytics.Event):
    type = "error.created"

    attributes = (
        analytics.Attribute("group_id", type=str),
        analytics.Attribute("installation_id", type=int),
    )


analytics.register(ErrorCreatedEvent)
