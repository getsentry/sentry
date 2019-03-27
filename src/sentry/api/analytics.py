from __future__ import absolute_import, print_function

from sentry import analytics


class OrganizationSearchCreatedEvent(analytics.Event):
    # HELP is organization-search a reasonable name here or should it just be saved searches
    type = 'organization-search.created'

    attributes = (
        analytics.Attribute('organization_id'),
        analytics.Attribute('type'),
        analytics.Attribute('id'),
        analytics.Attribute('user_id'),
    )


class OrganizationSearchDeletedEvent(analytics.Event):
    # HELP is organization-search a reasonable name here or should it just be saved searches
    type = 'organization-search.deleted'

    attributes = (
        analytics.Attribute('organization_id'),
        analytics.Attribute('type'),
        analytics.Attribute('id'),
        analytics.Attribute('user_id'),
    )


analytics.register(OrganizationSearchCreatedEvent)
analytics.register(OrganizationSearchDeletedEvent)
