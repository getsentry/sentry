from sentry import analytics


@analytics.eventclass("integrations.slack.assign")
class SlackIntegrationAssign(analytics.Event):
    actor_id: int | None = None


@analytics.eventclass("integrations.slack.status")
class SlackIntegrationStatus(analytics.Event):
    organization_id: int
    status: str
    resolve_type: str | None = None
    user_id: int | None = None


@analytics.eventclass("integrations.slack.notification_sent")
class SlackIntegrationNotificationSent(analytics.Event):
    organization_id: str
    project_id: str | None = None
    category: str
    actor_id: str | None = None
    user_id: str | None = None
    group_id: str | None = None
    notification_uuid: str
    alert_id: str | None = None
    actor_type: str | None = None


@analytics.eventclass("integrations.identity_linked")
class IntegrationIdentityLinked(analytics.Event):
    provider: str
    actor_id: int
    actor_type: str


@analytics.eventclass("integrations.slack.chart_unfurl")
class IntegrationSlackChartUnfurl(analytics.Event):
    user_id: int | None = None
    organization_id: int
    unfurls_count: int


@analytics.eventclass("integrations.slack.chart_unfurl_action")
class IntegrationSlackLinkIdentity(analytics.Event):
    organization_id: int
    action: str


@analytics.eventclass("integrations.slack.approve_member_invitation")
class IntegrationSlackApproveMemberInvitation(analytics.Event):
    organization_id: str
    actor_id: str
    invitation_type: str
    invited_member_id: str


class IntegrationSlackRejectMemberInvitation(IntegrationSlackApproveMemberInvitation):
    type = "integrations.slack.reject_member_invitation"


analytics.register(SlackIntegrationAssign)
analytics.register(SlackIntegrationStatus)
analytics.register(IntegrationIdentityLinked)
analytics.register(IntegrationSlackChartUnfurl)
analytics.register(IntegrationSlackLinkIdentity)
analytics.register(IntegrationSlackApproveMemberInvitation)
analytics.register(IntegrationSlackRejectMemberInvitation)
