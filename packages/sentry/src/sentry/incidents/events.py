from sentry import analytics


class BaseIncidentEvent(analytics.Event):
    attributes = (
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


class IncidentCommentCreatedEvent(BaseIncidentEvent):
    type = "incident.comment"
    attributes = BaseIncidentEvent.attributes + (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("activity_id", required=False),
    )


analytics.register(IncidentCreatedEvent)
analytics.register(IncidentStatusUpdatedEvent)
analytics.register(IncidentCommentCreatedEvent)
