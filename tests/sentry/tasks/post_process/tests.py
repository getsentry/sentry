# -*- coding: utf-8 -*-

from __future__ import absolute_import

from mock import Mock, patch

from sentry.testutils import TestCase
from sentry.tasks.post_process import post_process_group


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
