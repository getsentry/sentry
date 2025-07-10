from sentry import analytics


@analytics.eventclass("checkin_processing_error.stored")
class CheckinProcessingErrorStored(analytics.Event):
    organization_id: str
    project_id: str
    monitor_slug: str
    error_types: list


analytics.register(CheckinProcessingErrorStored)
