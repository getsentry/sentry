from sentry import analytics


class OnboardingContinuationSent(analytics.Event):
    type = "onboarding_continuation.sent"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("providers"),
    )


analytics.register(OnboardingContinuationSent)
