from sentry.analytics import Analytics
from sentry.analytics.event import EventEnvelope
from sentry.testutils.cases import TestCase


class DummyAnalytics(Analytics):
    def __init__(self):
        self.events = []
        self.event_envelopes = []
        super().__init__()

    def record_event_envelope(self, envelope: EventEnvelope):
        self.event_envelopes.append(envelope)
        self.events.append(envelope.event)


class AnalyticsTest(TestCase):
    def test_record(self) -> None:
        organization = self.create_organization()
        provider = DummyAnalytics()
        provider.record("organization.created", organization)
        assert len(provider.events) == 1
        event = provider.events.pop(0)
        envelope = provider.event_envelopes.pop(0)
        assert envelope.datetime
        assert event.type == "organization.created"
        assert event.slug == organization.slug
        assert not event.actor_id

    def test_record_with_attrs(self) -> None:
        organization = self.create_organization()
        provider = DummyAnalytics()
        provider.record("organization.created", organization, actor_id=1)
        assert len(provider.events) == 1
        event = provider.events.pop(0)
        envelope = provider.event_envelopes.pop(0)
        assert event.type == "organization.created"
        assert envelope.datetime
        assert event.slug == organization.slug
        assert event.actor_id == 1
