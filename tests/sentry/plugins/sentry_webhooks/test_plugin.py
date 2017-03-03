# -*- coding: utf-8 -*-

from __future__ import absolute_import

import json
import responses

from exam import fixture

from sentry.models import Rule
from sentry.plugins import Notification
from sentry.plugins.sentry_webhooks.plugin import WebHooksPlugin
from sentry.testutils import TestCase


class WebHooksPluginTest(TestCase):
    @fixture
    def plugin(self):
        return WebHooksPlugin()

    @responses.activate
    def test_simple_notification(self):
        responses.add(responses.POST, 'http://example.com')

        group = self.create_group(message='Hello world')
        event = self.create_event(group=group, message='Hello world', tags={'level': 'warning'})

        rule = Rule.objects.create(project=self.project, label='my rule')

        notification = Notification(event=event, rule=rule)

        self.project.update_option('webhooks:urls', 'http://example.com')

        self.plugin.notify(notification)

        assert len(responses.calls) == 1

        payload = json.loads(responses.calls[0].request.body)

        assert payload['level'] == 'warning'
        assert payload['message'] == 'Hello world'
