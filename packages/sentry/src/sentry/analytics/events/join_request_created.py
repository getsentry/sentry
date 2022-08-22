from sentry import analytics


class JoinRequestCreatedEvent(analytics.Event):
    type = "join_request.created"

    attributes = (analytics.Attribute("member_id"), analytics.Attribute("organization_id"))


analytics.register(JoinRequestCreatedEvent)
