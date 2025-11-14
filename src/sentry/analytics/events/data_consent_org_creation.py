from typing import int
from sentry import analytics


@analytics.eventclass("aggregated_data_consent.organization_created")
class AggregatedDataConsentOrganizationCreatedEvent(analytics.Event):
    organization_id: int


analytics.register(AggregatedDataConsentOrganizationCreatedEvent)
