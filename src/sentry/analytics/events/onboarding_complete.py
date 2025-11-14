from typing import int
from sentry import analytics


@analytics.eventclass("onboarding.complete")
class OnboardingCompleteEvent(analytics.Event):
    user_id: int
    organization_id: int
    referrer: str


analytics.register(OnboardingCompleteEvent)
