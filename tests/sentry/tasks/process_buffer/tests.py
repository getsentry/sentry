# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from celery.task import Task
from sentry.tasks.process_buffer import process_delay
from sentry.testutils import TestCase


class ProcessDelayTest(TestCase):
    def test_task_properties(self):
        assert isinstance(process_delay, Task)
        assert process_delay.name == 'sentry.tasks.process_buffer.process_delay'

    @mock.patch('sentry.app.buffer.process')
    def test_calls_process(self, process):
        process_delay(foo='bar', biz='baz')
        process.assert_called_once_with(foo='bar', biz='baz')
