from __future__ import absolute_import

import six

from datetime import datetime
from mock import patch

from sentry.models import Group
from sentry.testutils import TestCase
from sentry.tasks.servicehooks import (
    get_payload_v0, process_service_hook, process_resource_change
)
from sentry.testutils.helpers.faux import faux
from sentry.utils import json


class DictContaining(object):
    def __init__(self, *keys):
        self.keys = keys

    def __eq__(self, other):
        return all([k in other.keys() for k in self.keys])


class Any(object):
    def __eq__(self, other):
        return True


class TestServiceHooks(TestCase):
    def setUp(self):
        self.project = self.create_project()

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization
        )

        self.hook = self.create_service_hook(
            actor=self.install,
            application=self.install.sentry_app.application,
            project=self.project,
            events=('issue.created', ),
        )

    @patch('sentry.tasks.servicehooks.safe_urlopen')
    def test_group_created_sends_service_hook(self, safe_urlopen):
        with self.tasks():
            issue = self.create_group(project=self.project)

        data = json.loads(faux(safe_urlopen).kwargs['data'])
        assert data['action'] == 'issue.created'
        assert data['installation']['uuid'] == self.install.uuid
        assert data['data']['id'] == six.text_type(issue.id)
        assert faux(safe_urlopen).kwarg_equals('headers', DictContaining(
            'Content-Type',
            'X-ServiceHook-Timestamp',
            'X-ServiceHook-GUID',
            'X-ServiceHook-Signature',
        ))

    @patch('sentry.tasks.servicehooks.safe_urlopen')
    def test_non_group_events_dont_send_service_hooks(self, safe_urlopen):
        with self.tasks():
            self.create_project()

        assert len(safe_urlopen.calls) == 0

    @patch('sentry.tasks.servicehooks.safe_urlopen')
    def test_event_created_sends_service_hook(self, safe_urlopen):
        self.hook.update(events=['event.created', 'event.alert'])

        event = self.create_event(project=self.project)

        process_service_hook(self.hook.id, event)

        data = json.loads(faux(safe_urlopen).kwargs['data'])

        assert faux(safe_urlopen).kwarg_equals('url', self.hook.url)
        assert data == json.loads(json.dumps(get_payload_v0(event)))
        assert faux(safe_urlopen).kwarg_equals('headers', DictContaining(
            'Content-Type',
            'X-ServiceHook-Timestamp',
            'X-ServiceHook-GUID',
            'X-ServiceHook-Signature',
        ))

    @patch('sentry.models.Group.objects.get')
    @patch('sentry.tasks.servicehooks.process_resource_change.retry')
    def test_gracefully_handles_commit_race_condition(self, retry, get):
        does_not_exist = Group.DoesNotExist()

        # Fail once, then transaction commits, and next retry succeeds
        get.side_effect = [does_not_exist, None]

        with self.tasks():
            self.create_group(project=self.project)

        retry.assert_called_with(exc=does_not_exist)

    @patch('sentry.tasks.servicehooks.process_resource_change.delay')
    def test_does_not_enqueue_tasks_for_resource_updates(self, delay):
        group = self.create_group(project=self.project)
        group.update(last_seen=datetime.now())

        # Only called once for the create, not also for the update.
        delay.assert_called_once_with(sender='Group', instance_id=group.id)

    @patch('sentry.tasks.servicehooks.safe_urlopen')
    def test_handles_previous_method_signature(self, safe_urlopen):
        group = self.create_group(project=self.project)
        process_resource_change(Group, group.id, True)  # Doesn't raise
