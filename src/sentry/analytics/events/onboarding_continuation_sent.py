from sentry import analytics


@analytics.eventclass("onboarding_continuation.sent")
class OnboardingContinuationSent(analytics.Event):
    user_id: str
    organization_id: str
    providers: str


analytics.register(OnboardingContinuationSent)
