from __future__ import absolute_import

import responses

from exam import fixture
from django.core.urlresolvers import reverse
from sentry.models import Rule
from sentry.plugins.base import Notification
from sentry.testutils import PluginTestCase
from sentry.utils import json
from six.moves.urllib.parse import parse_qs

from sentry_plugins.pushover.plugin import PushoverPlugin

SUCCESS = """{"status":1,"request":"e460545a8b333d0da2f3602aff3133d6"}"""


class PushoverPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return PushoverPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "pushover"

    def test_entry_point(self):
        self.assertPluginInstalled("pushover", self.plugin)

    def test_is_configured(self):
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("apikey", "abcdef", self.project)
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("userkey", "abcdef", self.project)
        assert self.plugin.is_configured(self.project) is True

    @responses.activate
    def test_simple_notification(self):
        responses.add("POST", "https://api.pushover.net/1/messages.json", body=SUCCESS)
        self.plugin.set_option("userkey", "abcdef", self.project)
        self.plugin.set_option("apikey", "ghijkl", self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = parse_qs(request.body)
        assert payload == {
            "message": ["{}\n\nTags: level=warning".format(event.title)],
            "title": ["Bar: Hello world"],
            "url": [
                "http://example.com/organizations/baz/issues/{}/?referrer=pushover_plugin".format(
                    group.id
                )
            ],
            "url_title": ["Issue Details"],
            "priority": ["0"],
            "user": ["abcdef"],
            "token": ["ghijkl"],
            "expire": ["90"],
            "retry": ["30"],
        }

    @responses.activate
    def test_emergency_notification(self):
        responses.add("POST", "https://api.pushover.net/1/messages.json", body=SUCCESS)
        self.plugin.set_option("userkey", "abcdef", self.project)
        self.plugin.set_option("apikey", "ghijkl", self.project)
        self.plugin.set_option("priority", "2", self.project)
        self.plugin.set_option("expire", 90, self.project)
        self.plugin.set_option("retry", 30, self.project)

        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = parse_qs(request.body)
        assert payload == {
            "message": ["{}\n\nTags: level=warning".format(event.title)],
            "title": ["Bar: Hello world"],
            "url": [
                "http://example.com/organizations/baz/issues/{}/?referrer=pushover_plugin".format(
                    group.id
                )
            ],
            "url_title": ["Issue Details"],
            "priority": ["2"],
            "user": ["abcdef"],
            "token": ["ghijkl"],
            "expire": ["90"],
            "retry": ["30"],
        }

    def test_no_secrets(self):
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.plugin.set_option("userkey", "abcdef", self.project)
        self.plugin.set_option("apikey", "abcdef", self.project)
        url = reverse(
            "sentry-api-0-project-plugin-details",
            args=[self.org.slug, self.project.slug, "pushover"],
        )
        res = self.client.get(url)
        config = json.loads(res.content)["config"]
        userkey_config = [item for item in config if item["name"] == "userkey"][0]
        apikey_config = [item for item in config if item["name"] == "apikey"][0]
        assert userkey_config.get("type") == "secret"
        assert userkey_config.get("value") is None
        assert userkey_config.get("hasSavedValue") is True
        assert userkey_config.get("prefix") == "abcd"
        assert apikey_config.get("type") == "secret"
        assert apikey_config.get("value") is None
        assert apikey_config.get("hasSavedValue") is True
        assert apikey_config.get("prefix") == "abcd"
