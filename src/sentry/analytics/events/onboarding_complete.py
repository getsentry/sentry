from sentry import analytics


class OnboardingCompleteEvent(analytics.Event):
    type = "onboarding.complete"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("referrer"),
    )


analytics.register(OnboardingCompleteEvent)
