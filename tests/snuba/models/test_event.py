from __future__ import absolute_import

import calendar
from datetime import datetime, timedelta
import json
import requests

from django.conf import settings

from sentry.models.event import SnubaEvent
from sentry.testutils import TestCase


class SnubaEventTest(TestCase):
    def setUp(self):
        assert requests.post(settings.SENTRY_SNUBA + '/tests/drop').status_code == 200

        self.event_id = 'f' * 32
        self.now = datetime.utcnow() - timedelta(seconds=10)
        self.proj1 = self.create_project()
        self.proj1env1 = self.create_environment(project=self.proj1, name='test')
        self.proj1group1 = self.create_group(
            self.proj1,
            first_seen=self.now,
            last_seen=self.now + timedelta(seconds=14400)
        )

        data = json.dumps([{
            'event_id': self.event_id,
            'primary_hash': '1' * 32,
            'group_id': self.proj1group1.id,
            'project_id': self.proj1.id,
            'message': 'message 1',
            'platform': 'python',
            'datetime': self.now.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'data': {
                'received': calendar.timegm(self.now.timetuple()),
                'tags': {
                    'foo': 'bar',
                    'baz': 'quux',
                    'environment': 'prod',
                    'sentry:user': u'id:user1',
                    'sentry:release': 'release1',
                },
                'user': {
                    # change every 55 min so some hours have 1 user, some have 2
                    'id': u"user1",
                    'email': u"user1@sentry.io",
                }
            },
        }])

        assert requests.post(settings.SENTRY_SNUBA + '/tests/insert', data=data).status_code == 200
        # TODO put the body in nodestore?

    def test_fetch(self):
        event = SnubaEvent.get_event(self.proj1.id, self.event_id)
        assert event.event_id == self.event_id
        assert event.group.id == self.proj1group1.id
        assert event.project.id == self.proj1.id
