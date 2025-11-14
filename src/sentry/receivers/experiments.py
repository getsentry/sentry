from typing import int
import sentry_sdk

from sentry import analytics
from sentry.analytics.events.join_request_created import JoinRequestCreatedEvent
from sentry.analytics.events.join_request_link_viewed import JoinRequestLinkViewedEvent
from sentry.analytics.events.user_signup import UserSignUpEvent
from sentry.signals import join_request_created, join_request_link_viewed, user_signup


@join_request_created.connect(weak=False)
def record_join_request_created(member, **kwargs):
    try:
        analytics.record(
            JoinRequestCreatedEvent(
                member_id=member.id,
                organization_id=member.organization_id,
                referrer=kwargs.get("referrer"),
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@join_request_link_viewed.connect(weak=False)
def record_join_request_link_viewed(organization, **kwargs):
    try:
        analytics.record(JoinRequestLinkViewedEvent(organization_id=organization.id))
    except Exception as e:
        sentry_sdk.capture_exception(e)


@user_signup.connect(weak=False)
def record_user_signup(user, source, **kwargs):
    try:
        analytics.record(
            UserSignUpEvent(
                user_id=user.id,
                source=source,
                provider=kwargs.get("provider"),
                referrer=kwargs.get("referrer"),
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
