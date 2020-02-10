from __future__ import absolute_import

import responses
import six

from exam import fixture
from sentry.models import Rule
from sentry.plugins.base import Notification
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.opsgenie.plugin import OpsGeniePlugin


class OpsGeniePluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return OpsGeniePlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "opsgenie"

    def test_entry_point(self):
        self.assertPluginInstalled("opsgenie", self.plugin)

    def test_is_configured(self):
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("api_key", "abcdef", self.project)
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("alert_url", "https://api.opsgenie.com/v2/alerts", self.project)
        assert self.plugin.is_configured(self.project) is True

    @responses.activate
    def test_simple_notification(self):
        responses.add("POST", "https://api.opsgenie.com/v2/alerts")
        self.plugin.set_option("api_key", "abcdef", self.project)
        self.plugin.set_option("alert_url", "https://api.opsgenie.com/v2/alerts", self.project)
        self.plugin.set_option("recipients", "me", self.project)

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
        group_id = six.text_type(group.id)
        assert payload == {
            "recipients": "me",
            "tags": ["level:warning"],
            "entity": "foo.bar",
            "alias": "sentry: %s" % group_id,
            "details": {
                "Project Name": self.project.name,
                "Triggering Rules": '["my rule"]',
                "Sentry Group": "Hello world",
                "Sentry ID": group_id,
                "Logger": "",
                "Level": "warning",
                "Project ID": "bar",
                "URL": "http://example.com/organizations/baz/issues/%s/" % group_id,
            },
            "message": "Hello world",
            "source": "Sentry",
        }
