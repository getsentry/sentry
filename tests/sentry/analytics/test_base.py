from typing import Any

from sentry.analytics import Analytics
from sentry.analytics.event import EventEnvelope
from sentry.analytics.events.organization_created import OrganizationCreatedEvent
from sentry.testutils.cases import TestCase


class DummyAnalytics(Analytics):
    def __init__(self) -> None:
        self.events: list[Any] = []
        self.event_envelopes: list[EventEnvelope] = []
        super().__init__()

    def record_event_envelope(self, envelope: EventEnvelope) -> None:
        self.event_envelopes.append(envelope)
        self.events.append(envelope.event)


class AnalyticsTest(TestCase):
    def test_record(self) -> None:
        organization = self.create_organization()
        provider = DummyAnalytics()
        provider.record(
            OrganizationCreatedEvent(
                id=organization.id,
                name=organization.name,
                slug=organization.slug,
            )
        )
        assert len(provider.events) == 1
        event = provider.events.pop(0)
        envelope = provider.event_envelopes.pop(0)
        assert envelope.datetime
        assert event.type == "organization.created"
        assert event.slug == organization.slug
        assert not event.actor_id
