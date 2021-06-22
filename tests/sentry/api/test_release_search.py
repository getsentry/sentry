from unittest import TestCase

import pytest

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.api.release_search import RELEASE_FREE_TEXT_KEY, parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.constants import SEMVER_ALIAS


class ParseSearchQueryTest(TestCase):
    def test_invalid_key(self):
        with pytest.raises(InvalidSearchQuery, match="Invalid key for this search"):
            parse_search_query("bad_key:>1.2.3")

    def test_semver(self):
        assert parse_search_query(f"{SEMVER_ALIAS}:>1.2.3") == [
            SearchFilter(key=SearchKey(name=SEMVER_ALIAS), operator=">", value=SearchValue("1.2.3"))
        ]
        assert parse_search_query(f"{SEMVER_ALIAS}:>1.2.3 1.2.*") == [
            SearchFilter(
                key=SearchKey(name=SEMVER_ALIAS), operator=">", value=SearchValue("1.2.3")
            ),
            SearchFilter(
                key=SearchKey(name=RELEASE_FREE_TEXT_KEY), operator="=", value=SearchValue("1.2.*")
            ),
        ]
