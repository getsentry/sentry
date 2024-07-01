from sentry import analytics


class AggregatedDataConsentOrganizationCreatedEvent(analytics.Event):
    type = "aggregated_data_consent.organization_created"

    attributes = (analytics.Attribute("organization_id"),)


analytics.register(AggregatedDataConsentOrganizationCreatedEvent)
