from sentry import analytics


@analytics.eventclass("onboarding_continuation.sent")
class OnboardingContinuationSent(analytics.Event):
    user_id: int
    organization_id: int
    providers: str


analytics.register(OnboardingContinuationSent)
