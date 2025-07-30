import abc

from sentry import analytics


@analytics.eventclass("missing_members_nudge.sent")
class MissingMembersNudgeEvent(analytics.Event, abc.ABC):
    organization_id: int


analytics.register(MissingMembersNudgeEvent)
