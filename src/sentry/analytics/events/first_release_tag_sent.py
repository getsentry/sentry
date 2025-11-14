from typing import int
from sentry import analytics


@analytics.eventclass("first_release_tag.sent")
class FirstReleaseTagSentEvent(analytics.Event):
    user_id: int
    organization_id: int
    project_id: int


analytics.register(FirstReleaseTagSentEvent)
