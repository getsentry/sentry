from sentry.api.serializers import serialize
from sentry.models.recentsearch import RecentSearch
from sentry.models.search_common import SearchType
from sentry.testutils.cases import TestCase


class RecentSearchSerializerTest(TestCase):
    def test_simple(self):
        search = RecentSearch.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            type=SearchType.ISSUE.value,
            query="some query",
        )
        result = serialize(search)

        assert result["id"] == str(search.id)
        assert result["organizationId"] == str(search.organization_id)
        assert result["type"] == search.type
        assert result["query"] == search.query
        assert result["lastSeen"] == search.last_seen
        assert result["dateCreated"] == search.date_added
