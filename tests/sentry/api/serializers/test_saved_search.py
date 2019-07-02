# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.models import SavedSearch
from sentry.models.savedsearch import DEFAULT_SAVED_SEARCHES
from sentry.testutils import TestCase


class SavedSearchSerializerTest(TestCase):
    def test_global(self):
        default_saved_search = DEFAULT_SAVED_SEARCHES[0]
        search = SavedSearch(
            name=default_saved_search['name'],
            query=default_saved_search['query'],
            is_global=True,
        )
        result = serialize(search)

        assert result['id'] == six.text_type(search.id)
        assert result['type'] == search.type
        assert result['name'] == search.name
        assert result['query'] == search.query
        assert result['dateCreated'] == search.date_added
        assert result['isGlobal']
        assert not result['isPinned']

    def test_organization(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            name='Something',
            query='some query'
        )
        result = serialize(search)

        assert result['id'] == six.text_type(search.id)
        assert result['type'] == search.type
        assert result['name'] == search.name
        assert result['query'] == search.query
        assert result['dateCreated'] == search.date_added
        assert not result['isGlobal']
        assert not result['isPinned']

    def test_pinned(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.user,
            name='Something',
            query='some query'
        )
        result = serialize(search)

        assert result['id'] == six.text_type(search.id)
        assert result['type'] == search.type
        assert result['name'] == search.name
        assert result['query'] == search.query
        assert result['dateCreated'] == search.date_added
        assert not result['isGlobal']
        assert result['isPinned']
