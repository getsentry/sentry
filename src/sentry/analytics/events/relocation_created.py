from sentry import analytics


@analytics.eventclass("relocation.created")
class RelocationCreatedEvent(analytics.Event):
    creator_id: str
    owner_id: str
    uuid: str


analytics.register(RelocationCreatedEvent)
