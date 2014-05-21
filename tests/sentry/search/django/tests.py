# -*- coding: utf-8 -*-

from __future__ import absolute_import

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
        )
        group2 = self.create_group(
            project=project,
            checksum='b' * 40,
            message='bar',
        )

        results = self.backend.query(project, query='foo')
        assert len(results) == 1
        assert results[0] == group1

        results = self.backend.query(project, query='bar')
        assert len(results) == 1
        assert results[0] == group2
