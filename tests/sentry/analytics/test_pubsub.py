from unittest.mock import MagicMock

from sentry.analytics.event import EventEnvelope
from sentry.analytics.events.organization_created import OrganizationCreatedEvent
from sentry.analytics.mcp_attribution import McpAttribution, mcp_attribution_scope
from sentry.analytics.pubsub import PubSubAnalytics
from sentry.testutils.cases import TestCase
from sentry.utils.json import loads


class PubSubAnalyticsTest(TestCase):
    def test_publishes_request_attribution(self) -> None:
        analytics = object.__new__(PubSubAnalytics)
        analytics.publisher = MagicMock()
        analytics.topic = "analytics-events"
        envelope = EventEnvelope(OrganizationCreatedEvent(id=1, name="Example", slug="example"))

        with mcp_attribution_scope(McpAttribution(mcp=True, client="cursor", utm_source="plugin")):
            analytics.record_event_envelope(envelope)

        payload = loads(analytics.publisher.publish.call_args.kwargs["data"])
        assert payload["data"]["mcp"] is True
        assert payload["data"]["mcp_client"] == "cursor"
        assert payload["data"]["mcp_utm_source"] == "plugin"

    def test_publishes_explicit_non_mcp_attribution(self) -> None:
        analytics = object.__new__(PubSubAnalytics)
        analytics.publisher = MagicMock()
        analytics.topic = "analytics-events"
        envelope = EventEnvelope(OrganizationCreatedEvent(id=1, name="Example", slug="example"))

        analytics.record_event_envelope(envelope)

        payload = loads(analytics.publisher.publish.call_args.kwargs["data"])
        assert "mcp" not in payload["data"]
        assert "mcp_client" not in payload["data"]
        assert "mcp_utm_source" not in payload["data"]
