from sentry import analytics


@analytics.eventclass("onboarding.complete")
class OnboardingCompleteEvent(analytics.Event):
    user_id: int | None
    organization_id: int
    referrer: str


analytics.register(OnboardingCompleteEvent)
