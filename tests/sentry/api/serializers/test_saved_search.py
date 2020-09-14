# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.models import SavedSearch
from sentry.models.savedsearch import DEFAULT_SAVED_SEARCHES
from sentry.testutils import TestCase


class SavedSearchSerializerTest(TestCase):
    def test_simple(self):
        search = SavedSearch.objects.create(
            project=self.project, name="Something", query="some query"
        )
        result = serialize(search)

        assert result["id"] == six.text_type(search.id)
        assert result["projectId"] == six.text_type(search.project_id)
        assert result["type"] == search.type
        assert result["name"] == search.name
        assert result["query"] == search.query
        assert result["isDefault"] == search.is_default
        assert result["isUserDefault"] == search.is_default
        assert result["dateCreated"] == search.date_added
        assert not result["isPrivate"]
        assert not result["isGlobal"]
        assert not result["isPinned"]

    def test_global(self):
        default_saved_search = DEFAULT_SAVED_SEARCHES[0]
        search = SavedSearch(
            name=default_saved_search["name"], query=default_saved_search["query"], is_global=True
        )
        result = serialize(search)

        assert result["id"] == six.text_type(search.id)
        assert result["projectId"] is None
        assert result["type"] == search.type
        assert result["name"] == search.name
        assert result["query"] == search.query
        assert not result["isDefault"]
        assert not result["isUserDefault"]
        assert result["dateCreated"] == search.date_added
        assert not result["isPrivate"]
        assert result["isGlobal"]
        assert not result["isPinned"]

    def test_organization(self):
        search = SavedSearch.objects.create(
            organization=self.organization, name="Something", query="some query"
        )
        result = serialize(search)

        assert result["id"] == six.text_type(search.id)
        assert result["projectId"] is None
        assert result["type"] == search.type
        assert result["name"] == search.name
        assert result["query"] == search.query
        assert not result["isDefault"]
        assert not result["isUserDefault"]
        assert result["dateCreated"] == search.date_added
        assert not result["isPrivate"]
        assert not result["isGlobal"]
        assert not result["isPinned"]

    def test_pinned(self):
        search = SavedSearch.objects.create(
            organization=self.organization, owner=self.user, name="Something", query="some query"
        )
        result = serialize(search)

        assert result["id"] == six.text_type(search.id)
        assert result["projectId"] is None
        assert result["type"] == search.type
        assert result["name"] == search.name
        assert result["query"] == search.query
        assert not result["isDefault"]
        assert not result["isUserDefault"]
        assert result["dateCreated"] == search.date_added
        assert result["isPrivate"]
        assert not result["isGlobal"]
        assert result["isPinned"]
