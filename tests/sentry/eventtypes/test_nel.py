from sentry.eventtypes.nel import NelEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class NelEventTest(TestCase):
    def test_get_metadata(self):
        inst = NelEvent()
        data = {
            "logentry": {"formatted": "connection / tcp.refused"},
            "request": {"url": "https://example.com/"},
        }
        assert inst.get_metadata(data) == {
            "title": "connection / tcp.refused",
            "uri": "https://example.com/",
        }
