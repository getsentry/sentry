from sentry import analytics


class SlackIntegrationAssign(analytics.Event):
    type = "integrations.slack.assign"

    attributes = (analytics.Attribute("actor_id", required=False),)


class SlackIntegrationStatus(analytics.Event):
    type = "integrations.slack.status"

    attributes = (
        analytics.Attribute("status"),
        analytics.Attribute("resolve_type", required=False),
        analytics.Attribute("actor_id", required=False),
    )


# TODO: add field for whether target is user or team
class SlackIntegrationNotificationSent(analytics.Event):
    type = "integrations.slack.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id", required=False),
        analytics.Attribute("category"),
        analytics.Attribute("actor_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("group_id", required=False),
    )


class IntegrationIdentityLinked(analytics.Event):
    type = "integrations.identity_linked"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("actor_id"),
        analytics.Attribute("actor_type"),
    )


class IntegrationSlackChartUnfurl(analytics.Event):
    type = "integrations.slack.chart_unfurl"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("unfurls_count", type=int),
    )


class IntegrationSlackLinkIdentity(analytics.Event):
    type = "integrations.slack.chart_unfurl_action"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("action"),
    )


class IntegrationSlackApproveMemberInvitation(analytics.Event):
    type = "integrations.slack.approve_member_invitation"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("actor_id"),
        analytics.Attribute("invitation_type"),
        analytics.Attribute("invited_member_id"),
    )


class IntegrationSlackRejectMemberInvitation(IntegrationSlackApproveMemberInvitation):
    type = "integrations.slack.reject_member_invitation"


analytics.register(SlackIntegrationAssign)
analytics.register(SlackIntegrationNotificationSent)
analytics.register(SlackIntegrationStatus)
analytics.register(IntegrationIdentityLinked)
analytics.register(IntegrationSlackChartUnfurl)
analytics.register(IntegrationSlackLinkIdentity)
analytics.register(IntegrationSlackApproveMemberInvitation)
analytics.register(IntegrationSlackRejectMemberInvitation)
