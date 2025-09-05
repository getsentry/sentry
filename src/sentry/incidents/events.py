from sentry import analytics


@analytics.eventclass()
class BaseIncidentEvent(analytics.Event):
    incident_id: int
    organization_id: int
    incident_type: str


@analytics.eventclass("incident.created")
class IncidentCreatedEvent(BaseIncidentEvent):
    pass


@analytics.eventclass("incident.status_change")
class IncidentStatusUpdatedEvent(BaseIncidentEvent):
    prev_status: str
    status: str


analytics.register(IncidentCreatedEvent)
analytics.register(IncidentStatusUpdatedEvent)
