# -*- coding: utf-8 -*-

from __future__ import absolute_import

from mock import Mock, patch

from sentry.models import EventUser, Group
from sentry.testutils import TestCase
from sentry.tasks.post_process import (
    post_process_group, record_affected_user, record_additional_tags
)


class PostProcessGroupTest(TestCase):
    @patch('sentry.tasks.post_process.record_affected_user')
    @patch('sentry.rules.processor.RuleProcessor.apply', Mock(return_value=[]))
    def test_record_affected_user(self, mock_record_affected_user):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        post_process_group(
            event=event,
            is_new=True,
            is_regression=False,
            is_sample=False,
        )

        mock_record_affected_user.delay.assert_called_once_with(
            event=event,
        )

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


class RecordAffectedUserTest(TestCase):
    def test_simple(self):
        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'foo@example.com',
            },
        })

        with patch.object(Group.objects, 'add_tags') as add_tags:
            record_affected_user(event=event)

            add_tags.assert_called_once_with(event.group, [
                ('sentry:user', 'email:foo@example.com')
            ])

        assert EventUser.objects.filter(
            project=1,
            email='foo@example.com',
        ).exists()


class RecordAdditionalTagsTest(TestCase):
    def test_simple(self):
        # TODO(dcramer): this test ideally would actually test that tags get
        # added
        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'foo@example.com',
            },
        })

        with patch.object(Group.objects, 'add_tags') as add_tags:
            record_additional_tags(event=event)

            assert not add_tags.called
