from sentry.analytics import Analytics
from sentry.testutils.cases import TestCase


class DummyAnalytics(Analytics):
    def __init__(self):
        self.events = []
        super().__init__()

    def record_event(self, event):
        self.events.append(event)


class AnalyticsTest(TestCase):
    def test_record(self) -> None:
        organization = self.create_organization()
        provider = DummyAnalytics()
        provider.record("organization.created", organization)
        assert len(provider.events) == 1
        event = provider.events.pop(0)
        assert event.type == "organization.created"
        assert event.datetime_
        assert event.serialize()["data"]["slug"] == organization.slug
        assert not event.serialize()["data"]["actor_id"]

    def test_record_with_attrs(self) -> None:
        organization = self.create_organization()
        provider = DummyAnalytics()
        provider.record("organization.created", organization, actor_id=1)
        assert len(provider.events) == 1
        event = provider.events.pop(0)
        assert event.type == "organization.created"
        assert event.datetime_
        assert event.serialize()["data"]["slug"] == organization.slug
        assert event.serialize()["data"]["actor_id"] == 1
