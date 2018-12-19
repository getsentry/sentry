from __future__ import absolute_import

import calendar
from datetime import datetime, timedelta
import json
import pytz
import requests

from django.conf import settings

from sentry.models.event import SnubaEvent, Event
from sentry.testutils import TestCase
from sentry import nodestore


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

        # Raw event data
        data = {
            'event_id': self.event_id,
            'primary_hash': '1' * 32,
            'project_id': self.proj1.id,
            'message': 'message 1',
            'platform': 'python',
            'timestamp': calendar.timegm(self.now.timetuple()),
            'received': calendar.timegm(self.now.timetuple()),
            'tags': {
                'foo': 'bar',
                'baz': 'quux',
                'environment': 'prod',
                'sentry:user': u'id:user1',
                'sentry:release': 'release1',
            },
            'user': {
                'id': u'user1',
                'email': u'user1@sentry.io',
            }
        }

        # Create a regular django Event from the data, which will save the.
        # data in nodestore too. Once Postgres events are deprecated, we can
        # turn this off and just put the payload in nodestore.
        make_django_event = True
        if make_django_event:
            event_id = data.get('event_id')
            project_id = data.get('project_id')
            platform = data.get('platform')

            recorded_timestamp = data.get('timestamp')
            date = datetime.fromtimestamp(recorded_timestamp)
            date = date.replace(tzinfo=pytz.UTC)
            time_spent = data.get('time_spent')

            data['node_id'] = SnubaEvent.generate_node_id(project_id, event_id)

            e = Event(
                project_id=project_id or self._project.id,
                event_id=event_id,
                data=data,
                time_spent=time_spent,
                datetime=date,
                platform=platform
            )
            e.save()  # puts the payload in nodestore too
        else:
            node_id = SnubaEvent.generate_node_id(self.proj1.id, self.event_id)
            nodestore.set(node_id, data)
            assert nodestore.get(node_id) == data

        # Send event to snuba using snuba kafka message layout
        snuba_message = {
            'group_id': self.proj1group1.id,
            'data': data,

            # TODO copying these properties to the top level is pretty ad-hoc
            # but the snuba processor was written with this structure in mind
            # as that's what was in Kafka. Now that platform/event_id/etc are
            # kept in the event `data` payload, we can probably just start
            # using them from there.
            'datetime': datetime.fromtimestamp(data['timestamp']).strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'project_id': data['project_id'],
            'event_id': data['event_id'],
            'platform': data['platform'],
            'message': data['message'],
            'primary_hash': data['primary_hash'],
        }
        assert requests.post(
            settings.SENTRY_SNUBA + '/tests/insert',
            data=json.dumps([snuba_message])
        ).status_code == 200

    def test_fetch(self):
        event = SnubaEvent.get_event(self.proj1.id, self.event_id)

        # Make sure we get back event properties from snuba
        assert event.event_id == self.event_id
        assert event.group.id == self.proj1group1.id
        assert event.project.id == self.proj1.id

        # And the event data payload from nodestore
        assert event.data['user']['id'] == u'user1'
