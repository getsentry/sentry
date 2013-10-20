# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.search.django.backend import DjangoSearchBackend
from sentry.testutils import TestCase


def norm_date(dt):
    # mysql isnt playing nice
    return dt.replace(microsecond=0)


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
        assert norm_date(doc.date_added) == norm_date(event.group.first_seen)
        assert norm_date(doc.date_changed) == norm_date(event.group.last_seen)

        doc = self.backend.index(event.group, event)
        assert doc.project == event.project
        assert doc.group == event.group
        assert doc.total_events == 2
        assert norm_date(doc.date_added) == norm_date(event.group.first_seen)
        assert norm_date(doc.date_changed) == norm_date(event.group.last_seen)

    def test_search(self):
        event = self.event
        doc = self.backend.index(event.group, event)

        results = self.backend.query(event.project, event.message.upper())
        assert len(results) == 1
        [res] = results
        assert res.id == doc.id
