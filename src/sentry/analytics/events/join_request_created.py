from sentry import analytics


@analytics.eventclass("join_request.created")
class JoinRequestCreatedEvent(analytics.Event):
    member_id: str
    organization_id: str
    referrer: str | None = None


analytics.register(JoinRequestCreatedEvent)
