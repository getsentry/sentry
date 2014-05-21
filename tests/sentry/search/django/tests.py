# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import datetime
from exam import fixture

from sentry.search.django.backend import DjangoSearchBackend
from sentry.testutils import TestCase


class DjangoSearchTest(TestCase):
    @fixture
    def backend(self):
        return DjangoSearchBackend()

    def test_simple(self):
        project = self.project
        group1 = self.create_group(
            project=project,
            checksum='a' * 40,
            message='foo',
            last_seen=datetime(2013, 8, 13, 3, 8, 24, 880386),
            first_seen=datetime(2013, 7, 13, 3, 8, 24, 880386),
        )
        group2 = self.create_group(
            project=project,
            checksum='b' * 40,
            message='bar',
            last_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
            first_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
        )

        results = self.backend.query(project, query='foo')
        assert len(results) == 1
        assert results[0] == group1

        results = self.backend.query(project, query='bar')
        assert len(results) == 1
        assert results[0] == group2

        results = self.backend.query(project, sort_by='date')
        assert len(results) == 2
        assert results[0] == group1
        assert results[1] == group2

        results = self.backend.query(project, sort_by='new')
        assert len(results) == 2
        assert results[0] == group2
        assert results[1] == group1
