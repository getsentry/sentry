from __future__ import absolute_import

import responses

from exam import fixture
from sentry.models import Rule
from sentry.plugins.base import Notification
from sentry.testutils import PluginTestCase
from sentry.utils import json
from six.moves.urllib.parse import parse_qs

from sentry_plugins.slack.plugin import SlackPlugin


class SlackPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return SlackPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "slack"

    def test_entry_point(self):
        self.assertPluginInstalled("slack", self.plugin)

    @responses.activate
    def test_simple_notification(self):
        responses.add("POST", "http://example.com/slack")
        self.plugin.set_option("webhook", "http://example.com/slack", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning", "culprit": "foo.bar"},
            project_id=self.project.id,
        )
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = json.loads(parse_qs(request.body)["payload"][0])
        assert payload == {
            "username": "Sentry",
            "attachments": [
                {
                    "color": "#f18500",
                    "fields": [
                        {"short": False, "value": "foo.bar", "title": "Culprit"},
                        {"short": True, "value": "bar", "title": "Project"},
                    ],
                    "fallback": "[bar] Hello world",
                    "title": "Hello world",
                    "title_link": "http://example.com/organizations/baz/issues/%s/?referrer=slack"
                    % group.id,
                }
            ],
        }

    @responses.activate
    def test_notification_without_culprit(self):
        responses.add("POST", "http://example.com/slack")
        self.plugin.set_option("webhook", "http://example.com/slack", self.project)
        self.plugin.set_option("exclude_culprit", True, self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = json.loads(parse_qs(request.body)["payload"][0])
        assert payload == {
            "username": "Sentry",
            "attachments": [
                {
                    "color": "#f18500",
                    "fields": [{"short": True, "value": "bar", "title": "Project"}],
                    "fallback": "[bar] Hello world",
                    "title": "Hello world",
                    "title_link": "http://example.com/organizations/baz/issues/%s/?referrer=slack"
                    % group.id,
                }
            ],
        }

    @responses.activate
    def test_notification_without_project(self):
        responses.add("POST", "http://example.com/slack")
        self.plugin.set_option("webhook", "http://example.com/slack", self.project)
        self.plugin.set_option("exclude_project", True, self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning", "culprit": "foo.bar"},
            project_id=self.project.id,
        )
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = json.loads(parse_qs(request.body)["payload"][0])
        assert payload == {
            "username": "Sentry",
            "attachments": [
                {
                    "color": "#f18500",
                    "fields": [{"short": False, "value": "foo.bar", "title": "Culprit"}],
                    "fallback": "[bar] Hello world",
                    "title": "Hello world",
                    "title_link": "http://example.com/organizations/baz/issues/%s/?referrer=slack"
                    % group.id,
                }
            ],
        }
