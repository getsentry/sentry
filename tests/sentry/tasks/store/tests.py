# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from celery.task import Task
from sentry.tasks.store import store_event
from tests.base import TestCase


class StoreEventTest(TestCase):
    def test_is_task(self):
        self.assertTrue(isinstance(store_event, Task))

    @mock.patch('sentry.models.Group.objects.from_kwargs')
    def test_calls_from_kwargs(self, from_kwargs):
        data = {'foo': 'bar'}
        store_event(data=data)
        from_kwargs.assert_called_once_with(foo='bar')
