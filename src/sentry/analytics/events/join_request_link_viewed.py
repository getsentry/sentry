from sentry import analytics


class JoinRequestLinkViewedEvent(analytics.Event):
    type = "join_request.link_viewed"

    attributes = (analytics.Attribute("organization_id"),)


analytics.register(JoinRequestLinkViewedEvent)
