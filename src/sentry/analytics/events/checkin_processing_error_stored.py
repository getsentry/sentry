from sentry import analytics


@analytics.eventclass("checkin_processing_error.stored")
class CheckinProcessingErrorStored(analytics.Event):
    organization_id: int
    project_id: int
    monitor_slug: str
    error_types: list[int]


analytics.register(CheckinProcessingErrorStored)
