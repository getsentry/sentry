# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from datetime import datetime, timedelta
from sentry.buffer.base import Buffer
from sentry.models import Group, Project
from sentry.tasks.process_buffer import process_incr
from tests.base import TestCase


class BufferTest(TestCase):
    def setUp(self):
        self.buf = Buffer()

    @mock.patch('sentry.buffer.base.maybe_delay')
    def test_incr_delays_task(self, maybe_delay):
        model = mock.Mock()
        columns = {'times_seen': 1}
        filters = {'pk': 1}
        self.buf.incr(model, columns, filters)
        maybe_delay.assert_called_once_with(process_incr, model=model, columns=columns, filters=filters, extra=None)

    def test_process_saves_data(self):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'pk': group.pk}
        self.buf.process(Group, columns, filters)
        self.assertEquals(Group.objects.get(pk=group.pk).times_seen, group.times_seen + 1)

    def test_process_saves_extra(self):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'pk': group.pk}
        the_date = datetime.now() + timedelta(days=5)
        self.buf.process(Group, columns, filters, {'last_seen': the_date})
        group_ = Group.objects.get(pk=group.pk)
        self.assertEquals(group_.times_seen, group.times_seen + 1)
        self.assertEquals(group_.last_seen, the_date)
