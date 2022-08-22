from sentry import analytics
from sentry.signals import join_request_created, join_request_link_viewed, user_signup


@join_request_created.connect(weak=False)
def record_join_request_created(member, **kwargs):
    analytics.record(
        "join_request.created", member_id=member.id, organization_id=member.organization_id
    )


@join_request_link_viewed.connect(weak=False)
def record_join_request_link_viewed(organization, **kwargs):
    analytics.record("join_request.link_viewed", organization_id=organization.id)


@user_signup.connect(weak=False)
def record_user_signup(user, source, **kwargs):
    analytics.record(
        "user.signup",
        user_id=user.id,
        source=source,
        provider=kwargs.get("provider"),
        referrer=kwargs.get("referrer"),
    )
