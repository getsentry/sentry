from sentry import analytics


@analytics.eventclass("onboarding.complete")
class OnboardingCompleteEvent(analytics.Event):
    user_id: str
    organization_id: str
    referrer: str


analytics.register(OnboardingCompleteEvent)
