# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import SearchDocument
from sentry.testutils import TestCase


class SearchIndexTest(TestCase):
    def test_index_behavior(self):
        event = self.event

        doc = SearchDocument.objects.index(event)
        self.assertEquals(doc.project, event.project)
        self.assertEquals(doc.group, event.group)
        self.assertEquals(doc.total_events, 1)
        self.assertEquals(doc.date_added, event.group.first_seen)
        self.assertEquals(doc.date_changed, event.group.last_seen)

        doc = SearchDocument.objects.index(event)
        self.assertEquals(doc.project, event.project)
        self.assertEquals(doc.group, event.group)
        self.assertEquals(doc.total_events, 2)
        self.assertEquals(doc.date_added, event.group.first_seen)
        self.assertEquals(doc.date_changed, event.group.last_seen)

    def test_search(self):
        event = self.event
        doc = SearchDocument.objects.index(event)

        results = list(SearchDocument.objects.search(event.project, event.message.upper()))
        [res] = results
        self.assertEqual(res.id, doc.id)
