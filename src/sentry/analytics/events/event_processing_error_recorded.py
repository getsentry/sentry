from sentry import analytics


@analytics.eventclass("event_processing_error.recorded")
class EventProcessingErrorRecorded(analytics.Event):
    organization_id: int
    project_id: int
    event_id: str
    group_id: int | None
    error_type: str
    platform: str | None


analytics.register(EventProcessingErrorRecorded)
