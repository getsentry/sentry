from functools import cached_property
from urllib.parse import parse_qs

import pytest
import responses

from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR
from sentry.models.rule import Rule
from sentry.plugins.base import Notification
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import PluginTestCase
from sentry.utils import json
from sentry_plugins.slack.plugin import SlackPlugin


class SlackPluginTest(PluginTestCase):
    @cached_property
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
        assert group is not None

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = json.loads(parse_qs(request.body)["payload"][0])
        assert payload == {
            "username": "Sentry",
            "attachments": [
                {
                    "color": LEVEL_TO_COLOR["warning"],
                    "fields": [
                        {"short": False, "value": "foo.bar", "title": "Culprit"},
                        {"short": True, "value": "bar", "title": "Project"},
                    ],
                    "fallback": "[bar] Hello world",
                    "title": "Hello world",
                    "title_link": group.get_absolute_url(params={"referrer": "slack"}),
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
        assert group is not None

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = json.loads(parse_qs(request.body)["payload"][0])
        assert payload == {
            "username": "Sentry",
            "attachments": [
                {
                    "color": LEVEL_TO_COLOR["warning"],
                    "fields": [{"short": True, "value": "bar", "title": "Project"}],
                    "fallback": "[bar] Hello world",
                    "title": "Hello world",
                    "title_link": group.get_absolute_url(params={"referrer": "slack"}),
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
        assert group is not None

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = json.loads(parse_qs(request.body)["payload"][0])
        assert payload == {
            "username": "Sentry",
            "attachments": [
                {
                    "color": LEVEL_TO_COLOR["warning"],
                    "fields": [{"short": False, "value": "foo.bar", "title": "Culprit"}],
                    "fallback": "[bar] Hello world",
                    "title": "Hello world",
                    "title_link": group.get_absolute_url(params={"referrer": "slack"}),
                }
            ],
        }

    @responses.activate
    def test_no_error_on_404(self):
        responses.add("POST", "http://example.com/slack", status=404)
        self.plugin.set_option("webhook", "http://example.com/slack", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning", "culprit": "foo.bar"},
            project_id=self.project.id,
        )

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        # No exception since 404s are supposed to be ignored
        self.plugin.notify(notification)

        responses.replace("POST", "http://example.com/slack", status=400)

        # Other exceptions should not be ignored
        with pytest.raises(ApiError):
            self.plugin.notify(notification)

    @responses.activate
    def test_no_error_on_ignorable_slack_errors(self):
        responses.add("POST", "http://example.com/slack", status=403, body="action_prohibited")
        self.plugin.set_option("webhook", "http://example.com/slack", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning", "culprit": "foo.bar"},
            project_id=self.project.id,
        )

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        # No exception since certain errors are supposed to be ignored
        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        responses.replace("POST", "http://example.com/slack", status=403, body="some_other_error")

        # Other exceptions should not be ignored
        with pytest.raises(ApiError):
            self.plugin.notify(notification)
