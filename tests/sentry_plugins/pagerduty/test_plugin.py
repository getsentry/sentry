from __future__ import absolute_import

import responses
import six

from exam import fixture
from django.core.urlresolvers import reverse
from sentry.models import Rule
from sentry.plugins.base import Notification
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.pagerduty.plugin import PagerDutyPlugin

INVALID_METHOD = (
    '{"status":"invalid method","message":"You must use HTTP POST to submit your event"}'
)

SUCCESS = """{
  "status": "success",
  "message": "Event processed",
  "incident_key": "73af7a305bd7012d7c06002500d5d1a6"
}"""


class PagerDutyPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return PagerDutyPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "pagerduty"

    def test_entry_point(self):
        self.assertPluginInstalled("pagerduty", self.plugin)

    def test_is_configured(self):
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("service_key", "abcdef", self.project)
        assert self.plugin.is_configured(self.project) is True

    @responses.activate
    def test_simple_notification(self):
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
        group = event.group

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert payload == {
            "client_url": "http://example.com",
            "event_type": "trigger",
            "contexts": [
                {
                    "text": "View Sentry Issue Details",
                    "href": "http://example.com/organizations/baz/issues/{}/?referrer=pagerduty_plugin".format(
                        group.id
                    ),
                    "type": "link",
                }
            ],
            "incident_key": six.text_type(group.id),
            "client": "sentry",
            "details": {
                "project": self.project.name,
                "release": None,
                "url": "http://example.com/organizations/baz/issues/{}/?referrer=pagerduty_plugin".format(
                    group.id
                ),
                "culprit": group.culprit,
                "platform": "python",
                "event_id": event.event_id,
                "tags": {"level": "warning"},
                "datetime": event.datetime.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            },
            "service_key": "abcdef",
            "description": event.message,
        }

    def test_no_secrets(self):
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.plugin.set_option("service_key", "abcdef", self.project)
        url = reverse(
            "sentry-api-0-project-plugin-details",
            args=[self.org.slug, self.project.slug, "pagerduty"],
        )
        res = self.client.get(url)
        config = json.loads(res.content)["config"]
        key_config = [item for item in config if item["name"] == "service_key"][0]
        assert key_config.get("type") == "secret"
        assert key_config.get("value") is None
        assert key_config.get("hasSavedValue") is True
        assert key_config.get("prefix") == "abcd"
