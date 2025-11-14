from typing import int
from sentry import analytics


@analytics.eventclass("missing_members_nudge.sent")
class MissingMembersNudgeEvent(analytics.Event):
    organization_id: int


analytics.register(MissingMembersNudgeEvent)
