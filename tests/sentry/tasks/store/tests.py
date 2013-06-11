# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from celery.task import Task
from sentry.tasks.store import store_event
from sentry.testutils import TestCase


class StoreEventTest(TestCase):
    def test_is_task(self):
        assert isinstance(store_event, Task)

    @mock.patch('sentry.tasks.store.preprocess_event')
    def test_calls_from_kwargs(self, preprocess_event):
        data = {'foo': 'bar'}
        store_event(data=data)
        preprocess_event.delay.assert_called_once_with(data=data)
