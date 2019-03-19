from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models.recentsearch import RecentSearch
from sentry.utils.hashlib import md5_text


class RecentSearchTest(TestCase):
    def test_query_hash(self):
        recent_search = RecentSearch.objects.create(
            organization=self.organization,
            user=self.user,
            type=0,
            query='hello',
        )
        recent_search = RecentSearch.objects.get(id=recent_search.id)
        assert recent_search.query_hash == md5_text(recent_search.query).hexdigest()
