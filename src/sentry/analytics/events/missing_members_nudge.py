import abc

from sentry import analytics


class MissingMembersNudgeEvent(analytics.Event, abc.ABC):
    type = "missing_members_nudge.sent"
    attributes = [
        analytics.Attribute("organization_id"),
    ]


analytics.register(MissingMembersNudgeEvent)
