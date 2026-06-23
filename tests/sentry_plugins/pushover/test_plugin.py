from functools import cached_property
from urllib.parse import parse_qs

import responses

from sentry.models.rule import Rule
from sentry.plugins.base import Notification
from sentry.testutils.cases import PluginTestCase
from sentry_plugins.pushover.plugin import PushoverPlugin

SUCCESS = """{"status":1,"request":"e460545a8b333d0da2f3602aff3133d6"}"""


def test_conf_key() -> None:
    assert PushoverPlugin().conf_key == "pushover"


class PushoverPluginTest(PluginTestCase):
    @cached_property
    def plugin(self) -> PushoverPlugin:
        return PushoverPlugin()

    def test_is_configured(self) -> None:
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("apikey", "abcdef", self.project)
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("userkey", "abcdef", self.project)
        assert self.plugin.is_configured(self.project) is True

    @responses.activate
    def test_simple_notification(self) -> None:
        responses.add("POST", "https://api.pushover.net/1/messages.json", body=SUCCESS)
        self.plugin.set_option("userkey", "abcdef", self.project)
        self.plugin.set_option("apikey", "ghijkl", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        assert event.group is not None
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = parse_qs(request.body)
        assert payload == {
            "message": [f"{event.title}\n\nTags: interface_type=logentry, level=warning"],
            "title": ["Bar: Hello world"],
            "url": [
                f"http://example.com/organizations/baz/issues/{group.id}/?referrer=pushover_plugin"
            ],
            "url_title": ["Issue Details"],
            "priority": ["0"],
            "user": ["abcdef"],
            "token": ["ghijkl"],
            "expire": ["90"],
            "retry": ["30"],
        }

    @responses.activate
    def test_emergency_notification(self) -> None:
        responses.add("POST", "https://api.pushover.net/1/messages.json", body=SUCCESS)
        self.plugin.set_option("userkey", "abcdef", self.project)
        self.plugin.set_option("apikey", "ghijkl", self.project)
        self.plugin.set_option("priority", "2", self.project)
        self.plugin.set_option("expire", 90, self.project)
        self.plugin.set_option("retry", 30, self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        assert event.group is not None
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = parse_qs(request.body)
        assert payload == {
            "message": [f"{event.title}\n\nTags: interface_type=logentry, level=warning"],
            "title": ["Bar: Hello world"],
            "url": [
                f"http://example.com/organizations/baz/issues/{group.id}/?referrer=pushover_plugin"
            ],
            "url_title": ["Issue Details"],
            "priority": ["2"],
            "user": ["abcdef"],
            "token": ["ghijkl"],
            "expire": ["90"],
            "retry": ["30"],
        }
