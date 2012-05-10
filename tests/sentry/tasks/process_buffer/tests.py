# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from celery.task import Task
from sentry.tasks.process_buffer import process_incr
from tests.base import TestCase


class ProcessIncrTest(TestCase):
    def test_is_task(self):
        self.assertTrue(isinstance(process_incr, Task))

    @mock.patch('sentry.app.buffer.process')
    def test_calls_process(self, process):
        model = mock.Mock()
        columns = {'times_seen': 1}
        filters = {'pk': 1}
        process_incr(model=model, columns=columns, filters=filters)
        process.assert_called_once_with(model=model, columns=columns, filters=filters)
