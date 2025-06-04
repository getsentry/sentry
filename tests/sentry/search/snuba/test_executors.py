import pytest
from snuba_sdk import Entity

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.constants import TIMESTAMP_FIELDS
from sentry.search.events.types import SnubaParams
from sentry.search.snuba.executors import GroupAttributesPostgresSnubaQueryExecutor
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class GroupAttributesPostgresSnubaQueryExecutorTest(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.query_executor = GroupAttributesPostgresSnubaQueryExecutor()
        self.now = before_now()
        self.one_min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)

    def test_get_basic_event_snuba_condition_timestamp_fields(self):
        for field in TIMESTAMP_FIELDS:
            self.query_executor.get_basic_event_snuba_condition(
                SearchFilter(SearchKey(field), ">=", SearchValue(self.two_min_ago)),
                Entity("events", alias="e"),
                SnubaParams(
                    projects=[self.project],
                    organization=self.organization,
                    start=self.two_min_ago,
                    end=self.two_min_ago,
                ),
            )

    def test_get_basic_event_snuba_condition_timestamp_fields_missing_time_range(self):
        for field in TIMESTAMP_FIELDS:
            with pytest.raises(InvalidSearchQuery):
                self.query_executor.get_basic_event_snuba_condition(
                    SearchFilter(SearchKey(field), ">=", SearchValue(self.two_min_ago)),
                    Entity("events", alias="e"),
                    SnubaParams(
                        projects=[self.project],
                        organization=self.organization,
                    ),
                )

    def test_get_basic_event_snuba_condition_timestamp_fields_outside_time_range(self):
        for field in TIMESTAMP_FIELDS:
            with pytest.raises(InvalidSearchQuery):
                self.query_executor.get_basic_event_snuba_condition(
                    SearchFilter(SearchKey(field), ">=", SearchValue(self.now)),
                    Entity("events", alias="e"),
                    SnubaParams(
                        projects=[self.project],
                        organization=self.organization,
                        start=self.two_min_ago,
                        end=self.two_min_ago,
                    ),
                )
