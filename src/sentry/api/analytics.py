from __future__ import absolute_import, print_function

from sentry import analytics


class OrganizationSavedSearchCreatedEvent(analytics.Event):
    type = 'organization_saved_search.created'

    attributes = (
        analytics.Attribute('organization_id'),
        analytics.Attribute('search_type'),
        analytics.Attribute('id'),
        analytics.Attribute('user_id'),
    )


class OrganizationSavedSearchDeletedEvent(analytics.Event):
    type = 'organization_saved_search.deleted'

    attributes = (
        analytics.Attribute('organization_id'),
        analytics.Attribute('search_type'),
        analytics.Attribute('id'),
        analytics.Attribute('user_id'),
    )


analytics.register(OrganizationSavedSearchCreatedEvent)
analytics.register(OrganizationSavedSearchDeletedEvent)
