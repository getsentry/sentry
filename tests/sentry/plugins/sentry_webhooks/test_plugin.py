# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest
import responses

from exam import fixture

from sentry.exceptions import PluginError
from sentry.models import Rule
from sentry.plugins.base import Notification
from sentry.plugins.sentry_webhooks.plugin import validate_urls, WebHooksPlugin, WebHooksOptionsForm
from sentry.testutils import TestCase
from sentry.utils import json


class WebHooksPluginTest(TestCase):
    @fixture
    def plugin(self):
        return WebHooksPlugin()

    @responses.activate
    def test_simple_notification(self):
        responses.add(responses.POST, "http://example.com")
        event = self.store_event(
            data={"message": "Hello world", "level": "warning"}, project_id=self.project.id
        )
        rule = Rule.objects.create(project=self.project, label="my rule")
        notification = Notification(event=event, rule=rule)
        self.project.update_option("webhooks:urls", "http://example.com")

        self.plugin.notify(notification)

        assert len(responses.calls) == 1

        payload = json.loads(responses.calls[0].request.body)
        assert payload["level"] == "warning"
        assert payload["message"] == "Hello world"
        assert payload["event"]["id"] == event.event_id
        assert payload["event"]["event_id"] == event.event_id
        assert payload["triggering_rules"] == ["my rule"]

    def test_webhook_validation(self):
        # Test that you can't sneak a bad domain into the list of webhooks
        # without it being validated by delmiting with \r instead of \n
        bad_urls = "http://example.com\rftp://baddomain.com"
        form = WebHooksOptionsForm(data={"urls": bad_urls})
        form.is_valid()

        with pytest.raises(PluginError):
            validate_urls(form.cleaned_data.get("urls"))
