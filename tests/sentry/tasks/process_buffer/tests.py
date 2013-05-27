# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from celery.task import Task
from sentry.tasks.process_buffer import process_delay
from sentry.testutils import TestCase


class ProcessDelayTest(TestCase):
    def test_is_task(self):
        assert isinstance(process_delay, Task)

    @mock.patch('sentry.app.buffer.process_delay')
    def test_calls_process_delay(self, process_delay):
        model = mock.Mock()
        columns = {'times_seen': 1}
        filters = {'pk': 1}
        process_delay(model=model, columns=columns, filters=filters)
        process_delay.assert_called_once_with(model=model, columns=columns, filters=filters)
