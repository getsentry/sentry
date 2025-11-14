from typing import int
from sentry import analytics
from sentry.analytics.events.base_notification_sent import BaseNotificationSent


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
class SlackIntegrationNotificationSent(BaseNotificationSent):
    pass


@analytics.eventclass("integrations.slack.identity_linked")
class SlackIntegrationIdentityLinked(analytics.Event):
    provider: str
    actor_id: int
    actor_type: str


@analytics.eventclass("integrations.slack.chart_unfurl")
class SlackIntegrationChartUnfurl(analytics.Event):
    user_id: int | None = None
    organization_id: int
    unfurls_count: int


@analytics.eventclass("integrations.slack.chart_unfurl_action")
class SlackIntegrationChartUnfurlAction(analytics.Event):
    organization_id: int
    action: str


@analytics.eventclass("integrations.slack.approve_member_invitation")
class SlackIntegrationApproveMemberInvitation(analytics.Event):
    organization_id: int
    actor_id: int
    invitation_type: str
    invited_member_id: int


@analytics.eventclass("integrations.slack.reject_member_invitation")
class SlackIntegrationRejectMemberInvitation(SlackIntegrationApproveMemberInvitation):
    pass


analytics.register(SlackIntegrationAssign)
analytics.register(SlackIntegrationStatus)
analytics.register(SlackIntegrationIdentityLinked)
analytics.register(SlackIntegrationChartUnfurl)
analytics.register(SlackIntegrationChartUnfurlAction)
analytics.register(SlackIntegrationApproveMemberInvitation)
analytics.register(SlackIntegrationRejectMemberInvitation)
