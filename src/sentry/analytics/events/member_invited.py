from __future__ import absolute_import, print_function

from sentry import analytics


class MemberInvitedEvent(analytics.Event):
    type = "member.invited"

    attributes = (
        analytics.Attribute("inviter_user_id"),
        analytics.Attribute("invited_member_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("referrer", required=False),
    )


analytics.register(MemberInvitedEvent)
