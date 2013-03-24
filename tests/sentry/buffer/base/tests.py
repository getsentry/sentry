# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from datetime import timedelta
from django.utils import timezone
from sentry.buffer.base import Buffer
from sentry.models import Group, Project
from sentry.testutils import TestCase


class BufferTest(TestCase):
    def setUp(self):
        self.buf = Buffer()

    @mock.patch('sentry.buffer.base.process_incr')
    def test_incr_delays_task(self, process_incr):
        model = mock.Mock()
        columns = {'times_seen': 1}
        filters = {'pk': 1}
        self.buf.incr(model, columns, filters)
        kwargs = dict(model=model, columns=columns, filters=filters, extra=None)
        process_incr.apply_async.assert_called_once_with(
            kwargs=kwargs, countdown=5)

    def test_process_saves_data(self):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'pk': group.pk}
        self.buf.process(Group, columns, filters)
        assert Group.objects.get(pk=group.pk).times_seen == group.times_seen + 1

    def test_process_saves_extra(self):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'pk': group.pk}
        # strip micrseconds because MySQL doesnt seem to handle them correctly
        the_date = (timezone.now() + timedelta(days=5)).replace(microsecond=0)
        self.buf.process(Group, columns, filters, {'last_seen': the_date})
        group_ = Group.objects.get(pk=group.pk)
        assert group_.times_seen == group.times_seen + 1
        assert group_.last_seen.replace(microsecond=0) == the_date
