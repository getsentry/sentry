from __future__ import absolute_import

from sentry.tasks.merge import merge_group, rehash_group_events
from sentry.models import Event, Group
from sentry.testutils import TestCase


class MergeGroupTest(TestCase):
    def test_merge_with_event_integrity(self):
        project1 = self.create_project()
        group1 = self.create_group(project1)
        event1 = self.create_event('a' * 32, group=group1, data={'foo': 'bar'})
        project2 = self.create_project()
        group2 = self.create_group(project2)
        event2 = self.create_event('b' * 32, group=group2, data={'foo': 'baz'})

        with self.tasks():
            merge_group(group1.id, group2.id)

        assert not Group.objects.filter(id=group1.id).exists()

        # this previously would error with NodeIntegrityError due to the
        # reference check being bound to a group
        event1 = Event.objects.get(id=event1.id)
        assert event1.group_id == group2.id
        Event.objects.bind_nodes([event1], 'data')
        assert event1.data == {'foo': 'bar'}

        event2 = Event.objects.get(id=event2.id)
        assert event2.group_id == group2.id
        Event.objects.bind_nodes([event2], 'data')
        assert event2.data == {'foo': 'baz'}


class RehashGroupEventsTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        group = self.create_group(project)
        event1 = self.create_event('a' * 32, message='foo', group=group, data={})
        event2 = self.create_event('b' * 32, message='foo', group=group, data={})
        event3 = self.create_event('c' * 32, message='bar', group=group, data={})

        with self.tasks():
            rehash_group_events(group.id)

        assert not Group.objects.filter(id=group.id).exists()

        # this previously would error with NodeIntegrityError due to the
        # reference check being bound to a group
        event1 = Event.objects.get(id=event1.id)
        group1 = event1.group
        assert sorted(Event.objects.filter(group_id=group1.id).values_list('id', flat=True)) == [
            event1.id,
            event2.id,
        ]

        event3 = Event.objects.get(id=event3.id)
        group2 = event3.group
        assert sorted(Event.objects.filter(group_id=group2.id).values_list('id', flat=True)) == [
            event3.id,
        ]
