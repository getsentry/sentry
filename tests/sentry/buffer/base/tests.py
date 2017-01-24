# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from datetime import timedelta
from django.utils import timezone
from sentry.buffer.base import Buffer
from sentry.models import Group, Project, Release, ReleaseProject
from sentry.testutils import TestCase


class BufferTest(TestCase):
    def setUp(self):
        self.buf = Buffer()

    @mock.patch('sentry.buffer.base.process_incr')
    def test_incr_delays_task(self, process_incr):
        model = mock.Mock()
        columns = {'times_seen': 1}
        filters = {'id': 1}
        self.buf.incr(model, columns, filters)
        kwargs = dict(model=model, columns=columns, filters=filters, extra=None)
        process_incr.apply_async.assert_called_once_with(
            kwargs=kwargs)

    def test_process_saves_data(self):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'id': group.id, 'project_id': 1}
        self.buf.process(Group, columns, filters)
        assert Group.objects.get(id=group.id).times_seen == group.times_seen + 1

    def test_process_saves_data_without_existing_row(self):
        columns = {'times_seen': 1}
        filters = {'message': 'foo bar', 'project_id': 1}
        self.buf.process(Group, columns, filters)
        group = Group.objects.get(message='foo bar')
        assert group.times_seen == 1
        assert group.project_id == 1

    def test_process_saves_extra(self):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'id': group.id, 'project_id': 1}
        # strip micrseconds because MySQL doesn't seem to handle them correctly
        the_date = (timezone.now() + timedelta(days=5)).replace(microsecond=0)
        self.buf.process(Group, columns, filters, {'last_seen': the_date})
        group_ = Group.objects.get(id=group.id)
        assert group_.times_seen == group.times_seen + 1
        assert group_.last_seen.replace(microsecond=0) == the_date

    def test_increments_when_null(self):
        release_project = ReleaseProject.objects.create(
            project=Project(id=1),
            release=Release(id=1)
        )
        assert release_project.new_groups is None

        columns = {'new_groups': 1}
        filters = {'id': release_project.id}
        self.buf.process(ReleaseProject, columns, filters)
        release_project_ = ReleaseProject.objects.get(id=release_project.id)
        assert release_project_.new_groups == 1

    def test_get_where_clause(self):
        sql, vals = self.buf.get_where_clause_and_values({
            'release_id': 5,
            'project_id': 6
        })
        assert sql == 'WHERE project_id = %s AND release_id = %s'
        assert vals == [6, 5]

        sql, vals = self.buf.get_where_clause_and_values({'release_id': 5})
        assert sql == 'WHERE release_id = %s'
        assert vals == [5]

    def test_get_update_sql(self):
        sql, vals = self.buf.get_update_sql_and_vals(
            Group,
            {'times_seen': 1},
            {'id': 4, 'project_id': 5},
            {'message': 'there was an error'}
        )
        assert sql == (
            'UPDATE sentry_groupedmessage '
            'SET times_seen = COALESCE(times_seen, 0) + %s, message = %s '
            'WHERE project_id = %s AND id = %s'
        )

        assert vals == [1, 'there was an error', 5, 4]
