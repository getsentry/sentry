# -*- coding: utf-8 -*-

from __future__ import absolute_import

from mock import Mock, patch

from sentry.models import EventTag, TagKey, TagValue
from sentry.testutils import TestCase
from sentry.tasks.merge import merge_group
from sentry.tasks.post_process import index_event_tags, post_process_group


class PostProcessGroupTest(TestCase):
    @patch('sentry.tasks.post_process.record_affected_user', Mock())
    @patch('sentry.rules.processor.RuleProcessor')
    def test_rule_processor(self, mock_processor):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [
            (mock_callback, mock_futures),
        ]

        post_process_group(
            event=event,
            is_new=True,
            is_regression=False,
            is_sample=False,
        )

        mock_processor.assert_called_once_with(event, True, False, False)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(event, mock_futures)

    @patch('sentry.tasks.post_process.record_affected_user', Mock())
    @patch('sentry.rules.processor.RuleProcessor')
    def test_group_refresh(self, mock_processor):
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        event = self.create_event(group=group1)

        assert event.group_id == group1.id
        assert event.group == group1

        with self.tasks():
            merge_group(group1.id, group2.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [
            (mock_callback, mock_futures),
        ]

        post_process_group(
            event=event,
            is_new=True,
            is_regression=False,
            is_sample=False,
        )

        assert event.group == group2
        assert event.group_id == group2.id


class IndexEventTagsTest(TestCase):
    def test_simple(self):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        with self.tasks():
            index_event_tags.delay(
                event_id=event.id,
                group_id=group.id,
                project_id=self.project.id,
                tags=[('foo', 'bar'), ('biz', 'baz')],
            )

        tags = list(EventTag.objects.filter(
            event_id=event.id,
        ).values_list('key_id', 'value_id'))
        assert len(tags) == 2

        tagkey = TagKey.objects.get(
            key='foo',
            project=self.project,
        )
        tagvalue = TagValue.objects.get(
            key='foo',
            value='bar',
            project=self.project,
        )
        assert (tagkey.id, tagvalue.id) in tags

        tagkey = TagKey.objects.get(
            key='biz',
            project=self.project,
        )
        tagvalue = TagValue.objects.get(
            key='biz',
            value='baz',
            project=self.project,
        )
        assert (tagkey.id, tagvalue.id) in tags

        # ensure it safely handles repeat runs
        with self.tasks():
            index_event_tags.delay(
                event_id=event.id,
                group_id=group.id,
                project_id=self.project.id,
                tags=[('foo', 'bar'), ('biz', 'baz')],
            )

        queryset = EventTag.objects.filter(
            event_id=event.id,
        )
        assert queryset.count() == 2
