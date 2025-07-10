from sentry import analytics


@analytics.eventclass("organization.created")
class OrganizationCreatedEvent(analytics.Event):
    id: str
    name: str
    slug: str
    actor_id: str | None = None


analytics.register(OrganizationCreatedEvent)
