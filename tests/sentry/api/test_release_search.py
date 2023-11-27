from unittest import TestCase

import pytest

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.api.release_search import RELEASE_FREE_TEXT_KEY, parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.models.releaseprojectenvironment import ReleaseStages
from sentry.search.events.constants import RELEASE_ALIAS, RELEASE_STAGE_ALIAS, SEMVER_ALIAS


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

    def test_release(self):
        assert parse_search_query(f"{RELEASE_ALIAS}:12") == [
            SearchFilter(key=SearchKey(name=RELEASE_ALIAS), operator="=", value=SearchValue("12"))
        ]
        assert parse_search_query(f"{RELEASE_ALIAS}:12*") == [
            SearchFilter(key=SearchKey(name=RELEASE_ALIAS), operator="=", value=SearchValue("12*")),
        ]

    def test_release_stage(self):

        assert parse_search_query(f"{RELEASE_STAGE_ALIAS}:{ReleaseStages.ADOPTED.value}") == [
            SearchFilter(
                key=SearchKey(name=RELEASE_STAGE_ALIAS),
                operator="=",
                value=SearchValue(ReleaseStages.ADOPTED),
            )
        ]
        assert parse_search_query(f"!{RELEASE_STAGE_ALIAS}:{ReleaseStages.REPLACED.value}") == [
            SearchFilter(
                key=SearchKey(name=RELEASE_STAGE_ALIAS),
                operator="!=",
                value=SearchValue(ReleaseStages.REPLACED),
            )
        ]
        assert parse_search_query(
            f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED.value}, {ReleaseStages.LOW_ADOPTION.value}]"
        ) == [
            SearchFilter(
                key=SearchKey(name=RELEASE_STAGE_ALIAS),
                operator="IN",
                value=SearchValue([ReleaseStages.ADOPTED, ReleaseStages.LOW_ADOPTION]),
            ),
        ]
        assert parse_search_query(
            f"!{RELEASE_STAGE_ALIAS}:[{ReleaseStages.REPLACED.value}, {ReleaseStages.ADOPTED.value}]"
        ) == [
            SearchFilter(
                key=SearchKey(name=RELEASE_STAGE_ALIAS),
                operator="NOT IN",
                value=SearchValue([ReleaseStages.REPLACED, ReleaseStages.ADOPTED]),
            ),
        ]
