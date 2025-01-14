from functools import cached_property

import pytest
import responses

from sentry.exceptions import PluginError
from sentry.models.rule import Rule
from sentry.plugins.base import Notification
from sentry.plugins.sentry_webhooks.plugin import WebHooksOptionsForm, WebHooksPlugin, validate_urls
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


class WebHooksPluginTest(TestCase):
    @cached_property
    def plugin(self):
        return WebHooksPlugin()

    def setUp(self):
        self.event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        rule = Rule.objects.create(project=self.project, label="my rule")
        self.notification = Notification(event=self.event, rule=rule)
        self.project.update_option("webhooks:urls", "http://example.com")

    @responses.activate
    def test_simple_notification(self):
        responses.add(responses.POST, "http://example.com")

        self.plugin.notify(self.notification)

        assert len(responses.calls) == 1

        payload = json.loads(responses.calls[0].request.body)
        assert payload["level"] == "warning"
        assert payload["message"] == "Hello world"
        assert payload["event"]["id"] == self.event.event_id
        assert payload["event"]["event_id"] == self.event.event_id
        assert payload["triggering_rules"] == ["my rule"]

    @responses.activate
    def test_unsupported_text_response(self):
        """Test that a response of just text doesn't raise an error"""
        responses.add(
            responses.POST,
            "http://example.com",
            body='"some text"',
            content_type="application/json",
        )

        self.plugin.notify(self.notification)  # does not raise!

        assert len(responses.calls) == 1
        assert responses.calls[0].response.status_code == 200

    @responses.activate
    def test_unsupported_null_response(self):
        """Test that a response of null doesn't raise an error"""
        responses.add(
            responses.POST, "http://example.com", body="null", content_type="application/json"
        )

        self.plugin.notify(self.notification)  # does not raise!

        assert len(responses.calls) == 1
        assert responses.calls[0].response.status_code == 200

    @responses.activate
    def test_unsupported_int_response(self):
        """Test that a response of an integer doesn't raise an error"""
        responses.add(
            responses.POST, "http://example.com", body="1", content_type="application/json"
        )

        self.plugin.notify(self.notification)  # does not raise!

        assert len(responses.calls) == 1
        assert responses.calls[0].response.status_code == 200

    def test_webhook_validation(self):
        # Test that you can't sneak a bad domain into the list of webhooks
        # without it being validated by delimiting with \r instead of \n
        bad_urls = "http://example.com\rftp://baddomain.com"
        form = WebHooksOptionsForm(data={"urls": bad_urls})
        form.is_valid()

        with pytest.raises(PluginError):
            validate_urls(form.cleaned_data["urls"])

    @responses.activate
    def test_moved_permanently(self):
        """Test that we do not raise an error for 301s"""

        responses.add(responses.POST, "http://example.com", body="<moved permanently", status=301)

        self.plugin.notify(self.notification)  # does not raise!

        assert len(responses.calls) == 1
        assert responses.calls[0].response.status_code == 301
