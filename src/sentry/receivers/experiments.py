from __future__ import print_function, absolute_import

from sentry import analytics
from sentry.signals import join_request_created, join_request_link_viewed


@join_request_created.connect(weak=False)
def record_join_request_created(member, **kwargs):
    analytics.record(
        "join_request.created", member_id=member.id, organization_id=member.organization_id
    )


@join_request_link_viewed.connect(weak=False)
def record_join_request_link_viewed(organization, **kwargs):
    analytics.record("join_request.link_viewed", organization_id=organization.id)
