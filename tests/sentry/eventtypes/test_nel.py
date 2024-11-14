from sentry.eventtypes.nel import NelEvent
from sentry.testutils.cases import TestCase


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
