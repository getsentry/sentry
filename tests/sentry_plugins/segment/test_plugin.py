from __future__ import absolute_import

import responses

from exam import fixture
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.segment.plugin import SegmentPlugin


class SegmentPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return SegmentPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "segment"

    def test_entry_point(self):
        self.assertPluginInstalled("segment", self.plugin)

    @responses.activate
    def test_simple_notification(self):
        responses.add(responses.POST, "https://api.segment.io/v1/track")

        self.plugin.set_option("write_key", "secret-api-key", self.project)

        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1", "email": "foo@example.com"},
                "type": "error",
                "metadata": {"type": "ValueError", "value": "foo bar"},
                "level": "warning",
            },
            project_id=self.project.id,
        )

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.post_process(event)

        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert {
            "userId": "1",
            "event": "Error Captured",
            "context": {"library": {"name": "sentry", "version": self.plugin.version}},
            "properties": {
                "environment": "",
                "eventId": event.event_id,
                "exceptionType": "ValueError",
                "release": "",
                "transaction": "",
            },
            "integration": {"name": "sentry", "version": self.plugin.version},
            "timestamp": event.datetime.isoformat() + "Z",
        } == payload
