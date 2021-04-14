from sentry import analytics


class OrganizationCreatedEvent(analytics.Event):
    type = "organization.created"

    attributes = (
        analytics.Attribute("id"),
        analytics.Attribute("name"),
        analytics.Attribute("slug"),
        analytics.Attribute("actor_id", required=False),
    )


analytics.register(OrganizationCreatedEvent)
