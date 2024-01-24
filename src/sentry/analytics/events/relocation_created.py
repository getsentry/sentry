from sentry import analytics


class RelocationCreatedEvent(analytics.Event):
    type = "relocation.created"

    attributes = (
        analytics.Attribute("creator_id"),
        analytics.Attribute("owner_id"),
        analytics.Attribute("uuid"),
    )


analytics.register(RelocationCreatedEvent)
