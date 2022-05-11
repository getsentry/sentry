from tests.snuba.api.endpoints.test_organization_events_v2 import (
    OrganizationEventsV2EndpointTest,
    OrganizationEventsV2MetricsEnhancedPerformanceEndpointTest,
)


class OrganizationEventsEndpointTest(OrganizationEventsV2EndpointTest):
    viewname = "sentry-api-0-organization-events"
    referrer = "api.organization-events"


class OrganizationEventsMetricsEnhancedPerformanceEndpointTest(
    OrganizationEventsV2MetricsEnhancedPerformanceEndpointTest
):
    viewname = "sentry-api-0-organization-events"
