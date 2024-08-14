from sentry import analytics


class EventUserEqualityCheck(analytics.Event):
    type = "eventuser_equality.check"

    attributes = (
        analytics.Attribute("event_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("snuba_eventuser_equality", type=bool),
        analytics.Attribute("event_eventuser_equality", type=bool),
        analytics.Attribute("snuba_event_equality", type=bool),
    )


analytics.register(EventUserEqualityCheck)
