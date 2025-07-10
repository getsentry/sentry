from sentry import analytics


@analytics.eventclass("eventuser_equality.check")
class EventUserEqualityCheck(analytics.Event):
    event_id: str
    project_id: str
    group_id: str
    snuba_eventuser_equality: bool
    event_eventuser_equality: bool
    snuba_event_equality: bool


analytics.register(EventUserEqualityCheck)
