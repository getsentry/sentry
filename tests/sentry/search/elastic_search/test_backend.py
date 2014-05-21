# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.constants import STATUS_RESOLVED, STATUS_UNRESOLVED
from sentry.search.elastic_search.backend import ElasticSearchBackend
from sentry.testutils import TestCase


class ElasticSearchTest(TestCase):
    def setUp(self):
        from elasticsearch import Elasticsearch

        self.conn = Elasticsearch()
        try:
            self.conn.indices.delete(index='test-sentry-1')
        except Exception:
            pass

        self.backend = ElasticSearchBackend(index_prefix='test-')
        self.backend.upgrade()

    def test_simple(self):
        project1 = self.project
        project2 = self.create_project(team=self.team, name='estest')
        group1 = self.create_group(
            project=project1,
            checksum='a' * 40,
            message='foo',
            status=STATUS_RESOLVED,
        )
        event1 = self.create_event(
            event_id='a' * 40,
            group=group1,
            tags={
                'server': 'example.com',
                'env': 'production',
            }
        )
        group2 = self.create_group(
            project=project1,
            checksum='b' * 40,
            message='bar',
            status=STATUS_UNRESOLVED,
        )
        event2 = self.create_event(
            event_id='b' * 40,
            group=group2,
            tags={
                'server': 'example.com',
                'env': 'staging',
                'url': 'http://example.com',
            }
        )

        self.backend.index(group1, event1)
        self.backend.index(group2, event2)

        self.conn.indices.refresh(index='test-sentry-1')

        results = self.backend.query(project1, query='foo')
        assert len(results) == 1
        assert results[0] == group1

        results = self.backend.query(project1, query='bar')
        assert len(results) == 1
        assert results[0] == group2

        results = self.backend.query(project2, query='bar')
        assert len(results) == 0

        results = self.backend.query(project1, tags={'env': 'staging'})
        assert len(results) == 1
        assert results[0] == group2

        results = self.backend.query(project1, query='foo', tags={'env': 'staging'})
        assert len(results) == 0

        results = self.backend.query(project1, status=STATUS_RESOLVED)
        assert len(results) == 1
        assert results[0] == group1

        results = self.backend.query(project1, status=STATUS_UNRESOLVED)
        assert len(results) == 1
        assert results[0] == group2
