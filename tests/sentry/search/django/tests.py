# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.search.django.backend import DjangoSearchBackend
from sentry.testutils import TestCase, assert_date_resembles


class SearchIndexTest(TestCase):
    @fixture
    def backend(self):
        return DjangoSearchBackend()

    def test_index_behavior(self):
        event = self.event

        doc = self.backend.index(event.group, event)
        assert doc.project == event.project
        assert doc.group == event.group
        assert doc.total_events == 1
        assert_date_resembles(doc.date_added, event.group.first_seen)
        assert_date_resembles(doc.date_changed, event.group.last_seen)

        doc = self.backend.index(event.group, event)
        assert doc.project == event.project
        assert doc.group == event.group
        assert doc.total_events == 2
        assert_date_resembles(doc.date_added, event.group.first_seen)
        assert_date_resembles(doc.date_changed, event.group.last_seen)

    def test_search(self):
        event = self.event
        doc = self.backend.index(event.group, event)

        results = self.backend.query(event.project, event.message.upper())
        assert len(results) == 1
        [res] = results
        assert res.id == doc.id
