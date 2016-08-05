from __future__ import absolute_import

from sentry.tasks.merge import merge_group, rehash_group_events
from sentry.models import Event, Group, GroupMeta, GroupRedirect, GroupTagKey, GroupTagValue
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
        assert event1.data['foo'] == 'bar'

        event2 = Event.objects.get(id=event2.id)
        assert event2.group_id == group2.id
        Event.objects.bind_nodes([event2], 'data')
        assert event2.data['foo'] == 'baz'

    def test_merge_creates_redirect(self):
        groups = [self.create_group() for _ in range(0, 3)]

        with self.tasks():
            merge_group(groups[0].id, groups[1].id)

        assert not Group.objects.filter(id=groups[0].id).exists()
        assert GroupRedirect.objects.filter(
            group_id=groups[1].id,
            previous_group_id=groups[0].id,
        ).count() == 1

        with self.tasks():
            merge_group(groups[1].id, groups[2].id)

        assert not Group.objects.filter(id=groups[1].id).exists()
        assert GroupRedirect.objects.filter(
            group_id=groups[2].id,
        ).count() == 2

    def test_merge_updates_tag_values_seen(self):
        project = self.create_project()
        groups = [self.create_group(project) for _ in range(0, 2)]

        for group in groups:
            GroupTagKey.objects.create(
                project=project,
                group=group,
                key='sentry:user',
                values_seen=1,
            )
            GroupTagKey.objects.create(
                project=project,
                group=group,
                key='foo',
                values_seen=5,
            )
            GroupTagValue.objects.create(
                project=project,
                group=group,
                key='key1',
                times_seen=1,
            )
            GroupTagValue.objects.create(
                project=project,
                group=group,
                key='key2',
                times_seen=5,
            )

        with self.tasks():
            merge_group(groups[0].id, groups[1].id)

        assert not Group.objects.filter(id=groups[0].id).exists()
        assert not GroupTagKey.objects.filter(group_id=groups[0].id).exists()
        assert not GroupTagValue.objects.filter(group_id=groups[0].id).exists()

        assert GroupTagKey.objects.get(
            group_id=groups[1].id,
            key='sentry:user',
        ).values_seen == 2
        assert GroupTagKey.objects.get(
            group_id=groups[1].id,
            key='foo',
        ).values_seen == 10

        assert GroupTagValue.objects.get(
            group_id=groups[1].id,
            key='key1',
        ).times_seen == 2
        assert GroupTagValue.objects.get(
            group_id=groups[1].id,
            key='key2',
        ).times_seen == 10

    def test_merge_with_group_meta(self):
        project1 = self.create_project()
        group1 = self.create_group(project1)
        event1 = self.create_event('a' * 32, group=group1, data={'foo': 'bar'})
        project2 = self.create_project()
        group2 = self.create_group(project2)
        event2 = self.create_event('b' * 32, group=group2, data={'foo': 'baz'})

        GroupMeta.objects.create(
            group=event1.group,
            key='github:tid',
            value='134',
        )

        GroupMeta.objects.create(
            group=event1.group,
            key='other:tid',
            value='567',
        )

        GroupMeta.objects.create(
            group=event2.group,
            key='other:tid',
            value='abc',
        )

        GroupMeta.objects.populate_cache([group1, group2])

        assert GroupMeta.objects.get_value(group1, 'github:tid') == '134'
        assert GroupMeta.objects.get_value(group2, 'other:tid') == 'abc'
        assert not GroupMeta.objects.get_value(group2, 'github:tid')
        assert GroupMeta.objects.get_value(group1, 'other:tid') == '567'

        with self.tasks():
            merge_group(group1.id, group2.id)

        assert not Group.objects.filter(id=group1.id).exists()

        GroupMeta.objects.clear_local_cache()
        GroupMeta.objects.populate_cache([group1, group2])

        assert not GroupMeta.objects.get_value(group1, 'github:tid')
        assert not GroupMeta.objects.get_value(group1, 'other:tid')
        assert GroupMeta.objects.get_value(group2, 'github:tid') == '134'
        assert GroupMeta.objects.get_value(group2, 'other:tid') == 'abc'


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
