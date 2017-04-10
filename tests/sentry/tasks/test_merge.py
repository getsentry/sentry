from __future__ import absolute_import

from collections import defaultdict

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
        target, other = [self.create_group(project) for _ in range(0, 2)]

        data = {
            'sentry:user': {
                'id:1': {
                    target: 2,
                },
                'id:2': {
                    other: 3,
                },
                'id:3': {
                    target: 1,
                    other: 2,
                },
            },
            'key': {
                'foo': {
                    other: 3,
                },
            },
        }

        input_group_tag_keys = defaultdict(int)    # [(group, key)] = values_seen
        input_group_tag_values = defaultdict(int)  # [(group, key, value)] = times_seen
        output_group_tag_keys = defaultdict(int)    # [key] = values_seen
        output_group_tag_values = defaultdict(int)  # [(key, value)] = times_seen

        for key, values in data.items():
            output_group_tag_keys[key] = len(values)

            for value, groups in values.items():
                for group, count in groups.items():
                    input_group_tag_keys[(group, key)] += 1
                    input_group_tag_values[(group, key, value)] += count
                    output_group_tag_values[(key, value)] += count

        GroupTagKey.objects.bulk_create([
            GroupTagKey(
                project=project,
                group=group,
                key=key,
                values_seen=values_seen,
            ) for ((group, key), values_seen) in input_group_tag_keys.items()
        ])

        GroupTagValue.objects.bulk_create([
            GroupTagValue(
                project=project,
                group=group,
                key=key,
                value=value,
                times_seen=times_seen,
            ) for ((group, key, value), times_seen) in input_group_tag_values.items()
        ])

        with self.tasks():
            merge_group(other.id, target.id)

        assert not Group.objects.filter(id=other.id).exists()
        assert not GroupTagKey.objects.filter(group_id=other.id).exists()
        assert not GroupTagValue.objects.filter(group_id=other.id).exists()

        for key, values_seen in output_group_tag_keys.items():
            assert GroupTagKey.objects.get(
                project=project,
                group=target,
                key=key
            ).values_seen == values_seen

        for (key, value), times_seen in output_group_tag_values.items():
            assert GroupTagValue.objects.get(
                project=project,
                group=target,
                key=key,
                value=value,
            ).times_seen == times_seen

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
