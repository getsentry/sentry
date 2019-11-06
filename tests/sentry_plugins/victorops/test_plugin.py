from __future__ import absolute_import

import responses

from exam import fixture
from sentry.models import Rule
from sentry.plugins.base import Notification
from sentry.testutils import PluginTestCase
from sentry.utils import json

from new_sentry_plugins.victorops.plugin import VictorOpsPlugin

SUCCESS = """{
  "result":"success",
  "entity_id":"86dc4115-72d3-4219-9d8e-44939c1c409d"
}"""


class UnicodeTestInterface(object):
    def __init__(self, title, body):
        self.title = title
        self.body = body

    def to_string(self, event):
        return self.body

    def get_title(self):
        return self.title


class VictorOpsPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return VictorOpsPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "victorops"

    def test_entry_point(self):
        self.assertNewPluginInstalled("victorops", self.plugin)

    def test_is_configured(self):
        assert self.plugin.is_configured(self.project) is False
        self.plugin.set_option("api_key", "abcdef", self.project)
        assert self.plugin.is_configured(self.project) is True

    @responses.activate
    def test_simple_notification(self):
        responses.add(
            "POST",
            "https://alert.victorops.com/integrations/generic/20131114/alert/secret-api-key/everyone",
            body=SUCCESS,
        )
        self.plugin.set_option("api_key", "secret-api-key", self.project)
        self.plugin.set_option("routing_key", "everyone", self.project)

        group = self.create_group(message="Hello world", culprit="foo.bar")
        event = self.create_event(group=group, message="Hello world", tags={"level": "warning"})

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.notify(notification)

        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert {
            "message_type": "WARNING",
            "entity_id": group.id,
            "entity_display_name": "Hello world",
            "monitoring_tool": "sentry",
            "state_message": 'Stacktrace\n-----------\n\nStacktrace (most recent call last):\n\n  File "sentry/models/foo.py", line 29, in build_msg\n    string_max_length=self.string_max_length)\n\nMessage\n-----------\n\nHello world',
            "timestamp": int(event.datetime.strftime("%s")),
            "issue_url": "http://example.com/organizations/baz/issues/%s/" % group.id,
            "issue_id": group.id,
            "project_id": group.project.id,
        } == payload

    def test_build_description_unicode(self):
        group = self.create_group(message=u"Message", culprit=u"foo.bar")
        event = self.create_event(group=group, message=u"Messages", tags={u"level": u"error"})
        event.interfaces = {
            u"Message": UnicodeTestInterface(u"abcd\xde\xb4", u"\xdc\xea\x80\x80abcd\xde\xb4")
        }

        description = self.plugin.build_description(event)
        assert description == u"abcd\xde\xb4\n-----------\n\n\xdc\xea\x80\x80abcd\xde\xb4"
