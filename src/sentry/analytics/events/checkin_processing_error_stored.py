from sentry import analytics


class CheckinProcessingErrorStored(analytics.Event):
    type = "checkin_processing_error.stored"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("monitor_slug"),
        analytics.Attribute("error_types", type=list),
    )


analytics.register(CheckinProcessingErrorStored)
