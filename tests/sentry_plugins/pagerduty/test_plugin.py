from functools import cached_property

import orjson
import responses

from sentry.models.rule import Rule
from sentry.plugins.base import Notification
from sentry.testutils.cases import PluginTestCase
from sentry_plugins.pagerduty.plugin import PagerDutyPlugin

INVALID_METHOD = (
    '{"status":"invalid method","message":"You must use HTTP POST to submit your event"}'
)

SUCCESS = """{
  "status": "success",
  "message": "Event processed",
  "incident_key": "73af7a305bd7012d7c06002500d5d1a6"
}"""


def test_conf_key() -> None:
    assert PagerDutyPlugin().conf_key == "pagerduty"


class PagerDutyPluginTest(PluginTestCase):
    @cached_property
    def plugin(self) -> PagerDutyPlugin:
        return PagerDutyPlugin()

    def test_is_configured(self) -> None:
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("service_key", "abcdef", self.project)
        assert self.plugin.is_configured(self.project) is True

    @responses.activate
    def test_simple_notification(self) -> None:
        responses.add(
            "GET",
            "https://events.pagerduty.com/generic/2010-04-15/create_event.json",
            body=INVALID_METHOD,
        )
        responses.add(
            "POST",
            "https://events.pagerduty.com/generic/2010-04-15/create_event.json",
            body=SUCCESS,
        )
        self.plugin.set_option("service_key", "abcdef", self.project)

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        assert payload == {
            "client_url": "http://example.com",
            "event_type": "trigger",
            "contexts": [
                {
                    "text": "View Sentry Issue Details",
                    "href": f"http://example.com/organizations/baz/issues/{group.id}/?referrer=pagerduty_plugin",
                    "type": "link",
                }
            ],
            "incident_key": str(group.id),
            "client": "sentry",
            "details": {
                "project": self.project.name,
                "release": None,
                "url": f"http://example.com/organizations/baz/issues/{group.id}/?referrer=pagerduty_plugin",
                "culprit": group.culprit,
                "platform": "python",
                "event_id": event.event_id,
                "tags": {"interface_type": "logentry", "level": "warning"},
                "datetime": event.datetime.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            },
            "service_key": "abcdef",
            "description": event.message,
        }
