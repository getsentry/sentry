# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.models.recentsearch import RecentSearch
from sentry.models.search_common import SearchType
from sentry.testutils import TestCase


class RecentSearchSerializerTest(TestCase):
    def test_simple(self):
        search = RecentSearch.objects.create(
            organization=self.organization,
            user=self.user,
            type=SearchType.ISSUE.value,
            query="some query",
        )
        result = serialize(search)

        assert result["id"] == six.text_type(search.id)
        assert result["organizationId"] == six.text_type(search.organization_id)
        assert result["type"] == search.type
        assert result["query"] == search.query
        assert result["lastSeen"] == search.last_seen
        assert result["dateCreated"] == search.date_added
