from sentry import analytics


class BaseIncidentEvent(analytics.Event):
    attributes: tuple[analytics.Attribute, ...] = (
        analytics.Attribute("incident_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("incident_type"),
    )


class IncidentCreatedEvent(BaseIncidentEvent):
    type = "incident.created"


class IncidentStatusUpdatedEvent(BaseIncidentEvent):
    type = "incident.status_change"
    attributes = BaseIncidentEvent.attributes + (
        analytics.Attribute("prev_status"),
        analytics.Attribute("status"),
    )


analytics.register(IncidentCreatedEvent)
analytics.register(IncidentStatusUpdatedEvent)
