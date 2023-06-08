from functools import cached_property

import pytest
import responses

from sentry.models import Rule
from sentry.plugins.base import Notification
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils import PluginTestCase
from sentry.utils import json
from sentry_plugins.discord.plugin import LEVEL_TO_COLOR, DiscordPlugin


class DiscordPluginTest(PluginTestCase):
    @cached_property
    def plugin(self):
        return DiscordPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "discord"

    def test_entry_point(self):
        self.assertPluginInstalled("discord", self.plugin)

    @responses.activate
    def test_simple_notification(self):
        responses.add(
            "POST", "http://example.com/discord", content_type="application/json", body="{}"
        )
        self.plugin.set_option("webhook", "http://example.com/discord", self.project)

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
        payload = json.loads(request.body)
        assert payload == {
            "content": "",
            "embeds": [
                {
                    "title": "Hello world",
                    "url": "http://example.com/organizations/baz/issues/%s/?referrer=discord"
                    % group.id,
                    "color": LEVEL_TO_COLOR["warning"],
                    "fields": [
                        {"name": "Culprit", "value": "foo.bar", "inline": False},
                        {"name": "Project", "value": "bar", "inline": True},
                    ],
                }
            ],
            "username": "Sentry",
        }

    @responses.activate
    def test_notification_without_culprit(self):
        responses.add(
            "POST", "http://example.com/discord", content_type="application/json", body="{}"
        )
        self.plugin.set_option("webhook", "http://example.com/discord", self.project)
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
        payload = json.loads(request.body)
        assert payload == {
            "content": "",
            "embeds": [
                {
                    "title": "Hello world",
                    "url": "http://example.com/organizations/baz/issues/%s/?referrer=discord"
                    % group.id,
                    "color": LEVEL_TO_COLOR["warning"],
                    "fields": [{"name": "Project", "value": "bar", "inline": True}],
                }
            ],
            "username": "Sentry",
        }

    @responses.activate
    def test_notification_without_project(self):
        responses.add(
            "POST", "http://example.com/discord", content_type="application/json", body="{}"
        )
        self.plugin.set_option("webhook", "http://example.com/discord", self.project)
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
        payload = json.loads(request.body)
        assert payload == {
            "content": "",
            "embeds": [
                {
                    "title": "Hello world",
                    "url": "http://example.com/organizations/baz/issues/%s/?referrer=discord"
                    % group.id,
                    "color": LEVEL_TO_COLOR["warning"],
                    "fields": [{"name": "Culprit", "value": "foo.bar", "inline": False}],
                }
            ],
            "username": "Sentry",
        }

    @responses.activate
    def test_no_error_on_404(self):
        responses.add("POST", "http://example.com/discord", status=404)
        self.plugin.set_option("webhook", "http://example.com/discord", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning", "culprit": "foo.bar"},
            project_id=self.project.id,
        )

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        # No exception since 404s are supposed to be ignored
        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        responses.replace("POST", "http://example.com/discord", status=400)

        # Other exceptions should not be ignored
        with self.options({"system.url-prefix": "http://example.com"}):
            with pytest.raises(ApiError):
                self.plugin.notify(notification)
