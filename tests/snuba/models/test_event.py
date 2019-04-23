from __future__ import absolute_import

import calendar
from datetime import datetime, timedelta

from sentry.api.serializers import serialize
from sentry.models.event import Event, SnubaEvent
from sentry.testutils import SnubaTestCase, TestCase
from sentry import nodestore


class SnubaEventTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(SnubaEventTest, self).setUp()

        self.event_id = 'f' * 32
        self.now = datetime.utcnow().replace(microsecond=0) - timedelta(seconds=10)
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
            },
        }

        # Create a regular django Event from the data, which will save the.
        # data in nodestore too. Once Postgres events are deprecated, we can
        # turn this off and just put the payload in nodestore.
        make_django_event = True
        if make_django_event:
            self.create_event(
                event_id=data['event_id'],
                datetime=self.now,
                project=self.proj1,
                group=self.proj1group1,
                data=data,
            )
            nodestore_data = nodestore.get(
                SnubaEvent.generate_node_id(
                    self.proj1.id, self.event_id))
            assert data['event_id'] == nodestore_data['event_id']
        else:
            node_id = SnubaEvent.generate_node_id(self.proj1.id, self.event_id)
            nodestore.set(node_id, data)
            assert nodestore.get(node_id) == data

    def test_fetch(self):
        event = SnubaEvent.get_event(self.proj1.id, self.event_id)

        # Make sure we get back event properties from snuba
        assert event.event_id == self.event_id
        assert event.group.id == self.proj1group1.id
        assert event.project.id == self.proj1.id
        assert event._project_cache == self.proj1
        # That shouldn't have triggered a nodestore load yet
        assert event.data._node_data is None
        # But after we ask for something that's not in snuba
        event.get_hashes()
        # We should have populated the NodeData
        assert event.data._node_data is not None
        # And the full user should be in there.
        assert event.data['user']['id'] == u'user1'

    def test_same(self):
        django_event = Event.objects.get(project_id=self.proj1.id, event_id=self.event_id)
        snuba_event = SnubaEvent.get_event(self.proj1.id, self.event_id)

        assert django_event.group_id == snuba_event.group_id
        assert django_event.interfaces == snuba_event.interfaces
        assert django_event.datetime == snuba_event.datetime
        assert django_event.platform == snuba_event.platform

        assert django_event.as_dict() == snuba_event.as_dict()

        django_serialized = serialize(django_event)
        snuba_serialized = serialize(snuba_event)
        del django_serialized['id']
        del snuba_serialized['id']
        assert django_serialized == snuba_serialized

    def test_minimal(self):
        """
        Test that a SnubaEvent that only loads minimal data from snuba
        can still be serialized completely by falling back to nodestore data.
        """
        django_event = Event.objects.get(project_id=self.proj1.id, event_id=self.event_id)
        snuba_event = SnubaEvent.get_event(
            self.proj1.id,
            self.event_id,
            snuba_cols=SnubaEvent.minimal_columns)

        django_serialized = serialize(django_event)
        snuba_serialized = serialize(snuba_event)
        del django_serialized['id']
        del snuba_serialized['id']
        assert django_serialized == snuba_serialized

    def test_bind_nodes(self):
        """
        Test that bind_nodes works on snubaevents to populate their
        NodeDatas.
        """
        event = SnubaEvent.get_event(self.proj1.id, self.event_id)
        assert event.data._node_data is None
        Event.objects.bind_nodes([event], 'data')
        assert event.data._node_data is not None
        assert event.data['user']['id'] == u'user1'

    def test_event_with_no_body(self):
        # remove the event from nodestore to simulate an event with no body.
        node_id = SnubaEvent.generate_node_id(self.proj1.id, self.event_id)
        nodestore.delete(node_id)
        assert nodestore.get(node_id) is None

        # Check that we can still serialize it
        event = SnubaEvent.get_event(self.proj1.id, self.event_id)
        serialized = serialize(event)
        assert event.data == {}

        # Check that the regular serializer still gives us back tags
        assert serialized['tags'] == [
            {'_meta': None, 'key': 'baz', 'value': 'quux'},
            {'_meta': None, 'key': 'foo', 'value': 'bar'},
            {'_meta': None, 'key': 'release', 'value': 'release1'},
            {'_meta': None, 'key': 'user', 'query': 'user.id:user1', 'value': 'id:user1'}
        ]
