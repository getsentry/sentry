# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import Event, SearchDocument

from tests.base import TestCase


class SearchIndexTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def test_index_behavior(self):
        event = Event.objects.all()[0]
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
