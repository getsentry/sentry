# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from datetime import datetime, timedelta

from sentry.models import GroupBookmark, GroupStatus, GroupTagValue
from sentry.search.elastic_search.backend import ElasticSearchBackend
from sentry.testutils import TestCase
from sentry.testutils.skips import requires_elastic_search


@requires_elastic_search
class ElasticSearchTest(TestCase):
    def create_backend(self):
        return ElasticSearchBackend(index_prefix='test-')

    def setUp(self):
        self.backend = self.create_backend()

        from elasticsearch import Elasticsearch

        self.conn = Elasticsearch()
        try:
            self.conn.indices.delete(index='test-sentry-1')
        except Exception:
            pass

        self.backend = self.create_backend()
        self.backend.upgrade()

        self.project1 = self.create_project(name='foo')
        self.project2 = self.create_project(name='bar')

        self.group1 = self.create_group(
            project=self.project1,
            checksum='a' * 32,
            message='foo',
            times_seen=5,
            status=GroupStatus.UNRESOLVED,
            last_seen=datetime(2013, 8, 13, 3, 8, 24, 880386),
            first_seen=datetime(2013, 7, 13, 3, 8, 24, 880386),
        )
        self.event1 = self.create_event(
            event_id='a' * 32,
            group=self.group1,
            tags={
                'server': 'example.com',
                'env': 'production',
            }
        )

        self.group2 = self.create_group(
            project=self.project1,
            checksum='b' * 32,
            message='bar',
            times_seen=10,
            status=GroupStatus.RESOLVED,
            last_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
            first_seen=datetime(2013, 7, 14, 3, 8, 24, 880386),
        )
        self.event2 = self.create_event(
            event_id='b' * 32,
            group=self.group2,
            tags={
                'server': 'example.com',
                'env': 'staging',
                'url': 'http://example.com',
            }
        )

        for key, value in self.event1.data['tags']:
            GroupTagValue.objects.create(
                group=self.group1,
                key=key,
                value=value,
            )
        for key, value in self.event2.data['tags']:
            GroupTagValue.objects.create(
                group=self.group2,
                key=key,
                value=value,
            )

        GroupBookmark.objects.create(
            user=self.user,
            group=self.group2,
            project=self.group2.project,
        )

        self.backend.index(self.event1)
        self.backend.index(self.event2)

        self.conn.indices.refresh(index='test-sentry-1')

    def test_query(self):
        backend = self.create_backend()

        results = self.backend.query(self.project1, query='foo')
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(self.project1, query='bar')
        assert len(results) == 1
        assert results[0] == self.group2

    def test_sort(self):
        backend = self.create_backend()

        results = self.backend.query(self.project1, sort_by='date')
        assert len(results) == 2
        assert results[0] == self.group1
        assert results[1] == self.group2

        results = self.backend.query(self.project1, sort_by='new')
        assert len(results) == 2
        assert results[0] == self.group2
        assert results[1] == self.group1

        results = self.backend.query(self.project1, sort_by='freq')
        assert len(results) == 2
        assert results[0] == self.group2
        assert results[1] == self.group1

    def test_status(self):
        results = self.backend.query(self.project1, status=GroupStatus.UNRESOLVED)
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(self.project1, status=GroupStatus.RESOLVED)
        assert len(results) == 1
        assert results[0] == self.group2

    @pytest.mark.xfail
    def test_tags(self):
        results = self.backend.query(self.project1, tags={'env': 'staging'})
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(self.project1, tags={'env': 'example.com'})
        assert len(results) == 0

    def test_project(self):
        results = self.backend.query(self.project2)
        assert len(results) == 0

    @pytest.mark.xfail
    def test_bookmarked_by(self):
        results = self.backend.query(self.project1, bookmarked_by=self.user)
        assert len(results) == 1
        assert results[0] == self.group2

    def test_limit(self):
        results = self.backend.query(self.project1, limit=1)
        assert len(results) == 1

        results = self.backend.query(self.project1, limit=2)
        assert len(results) == 2

    def test_first_seen_date_filter(self):
        backend = self.create_backend()

        results = self.backend.query(
            self.project1, date_from=self.group2.first_seen,
            date_filter='first_seen')
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(
            self.project1, date_to=self.group1.first_seen + timedelta(minutes=1),
            date_filter='first_seen')
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(
            self.project1,
            date_from=self.group1.first_seen,
            date_to=self.group1.first_seen + timedelta(minutes=1),
            date_filter='first_seen',
        )
        assert len(results) == 1
        assert results[0] == self.group1

    def test_last_seen_date_filter(self):
        backend = self.create_backend()

        results = self.backend.query(
            self.project1, date_from=self.group1.last_seen,
            date_filter='last_seen')
        assert len(results) == 1
        assert results[0] == self.group1

        results = self.backend.query(
            self.project1,
            date_to=self.group1.last_seen - timedelta(minutes=1),
            date_filter='last_seen')
        assert len(results) == 1
        assert results[0] == self.group2

        results = self.backend.query(
            self.project1,
            date_from=self.group2.last_seen,
            date_to=self.group1.last_seen - timedelta(minutes=1),
            date_filter='last_seen',
        )
        assert len(results) == 1
        assert results[0] == self.group2
