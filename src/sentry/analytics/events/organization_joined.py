from __future__ import absolute_import

from sentry import analytics


class OrganizationJoinedEvent(analytics.Event):
    type = "organization.joined"

    attributes = (analytics.Attribute("user_id"), analytics.Attribute("organization_id"))


analytics.register(OrganizationJoinedEvent)
