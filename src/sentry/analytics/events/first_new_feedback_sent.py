from sentry import analytics


class FirstNewFeedbackSentEvent(analytics.Event):
    type = "first_new_feedback.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
        analytics.Attribute("user_id", required=False),
    )


analytics.register(FirstNewFeedbackSentEvent)
