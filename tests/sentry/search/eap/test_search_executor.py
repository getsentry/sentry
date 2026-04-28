from datetime import datetime, timedelta, timezone

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.search.eap.occurrences.search_executor import (
    run_eap_group_search,
    search_filters_to_query_string,
)
from sentry.testutils.cases import OccurrenceTestCase, SnubaTestCase, TestCase


class TestSearchFiltersToQueryString:
    def test_all_operator_types(self):
        cases = [
            (SearchFilter(SearchKey("level"), "=", SearchValue("error")), "level:error"),
            (SearchFilter(SearchKey("level"), "!=", SearchValue("error")), "!level:error"),
            (SearchFilter(SearchKey("count"), ">", SearchValue("5")), "count:>5"),
            (SearchFilter(SearchKey("count"), ">=", SearchValue("5")), "count:>=5"),
            (SearchFilter(SearchKey("count"), "<", SearchValue("5")), "count:<5"),
            (SearchFilter(SearchKey("count"), "<=", SearchValue("5")), "count:<=5"),
            (
                SearchFilter(SearchKey("level"), "IN", SearchValue(["error", "warning"])),
                "level:[error, warning]",
            ),
            (
                SearchFilter(SearchKey("level"), "NOT IN", SearchValue(["error", "warning"])),
                "!level:[error, warning]",
            ),
        ]
        for sf, expected in cases:
            assert search_filters_to_query_string([sf]) == expected, (
                f"Failed for operator {sf.operator}"
            )

    def test_value_formatting(self):
        dt = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        cases = [
            # Wildcards pass through as-is
            (SearchFilter(SearchKey("message"), "=", SearchValue("*foo*")), "message:*foo*"),
            # Spaces trigger quoting
            (
                SearchFilter(SearchKey("message"), "=", SearchValue("foo bar")),
                'message:"foo bar"',
            ),
            # Embedded quotes are escaped
            (
                SearchFilter(SearchKey("message"), "=", SearchValue('foo "bar"')),
                'message:"foo \\"bar\\""',
            ),
            # Numeric values
            (SearchFilter(SearchKey("count"), "=", SearchValue(42)), "count:42"),
            (SearchFilter(SearchKey("count"), ">", SearchValue(3.14)), "count:>3.14"),
            # Datetime values
            (
                SearchFilter(SearchKey("timestamp"), ">", SearchValue(dt)),
                "timestamp:>2024-01-15T12:00:00+00:00",
            ),
            # Tags pass through
            (
                SearchFilter(SearchKey("tags[browser]"), "=", SearchValue("chrome")),
                "tags[browser]:chrome",
            ),
        ]
        for sf, expected in cases:
            assert search_filters_to_query_string([sf]) == expected

    def test_has_and_not_has_filters(self):
        # has:user.email → parsed as op=!=, value=""
        has_filter = SearchFilter(SearchKey("user.email"), "!=", SearchValue(""))
        assert search_filters_to_query_string([has_filter]) == "has:user.email"

        # !has:user.email → parsed as op==, value=""
        not_has_filter = SearchFilter(SearchKey("user.email"), "=", SearchValue(""))
        assert search_filters_to_query_string([not_has_filter]) == "!has:user.email"

    def test_skipped_filters_are_dropped(self):
        filters = [
            SearchFilter(SearchKey("event.type"), "=", SearchValue("error")),
            SearchFilter(SearchKey("release.stage"), "=", SearchValue("adopted")),
            SearchFilter(SearchKey("release.version"), ">", SearchValue("1.0.0")),
            SearchFilter(SearchKey("release.package"), "=", SearchValue("com.example")),
            SearchFilter(SearchKey("release.build"), "=", SearchValue("123")),
            SearchFilter(SearchKey("user.display"), "=", SearchValue("john")),
            SearchFilter(SearchKey("team_key_transaction"), "=", SearchValue("1")),
            SearchFilter(SearchKey("transaction.status"), "=", SearchValue("ok")),
        ]
        assert search_filters_to_query_string(filters) == ""

    def test_aggregation_filters_translated(self):
        dt = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        cases = [
            (
                SearchFilter(SearchKey("times_seen"), ">", SearchValue("100")),
                "count():>100",
            ),
            (
                SearchFilter(SearchKey("times_seen"), "<=", SearchValue("50")),
                "count():<=50",
            ),
            (
                SearchFilter(SearchKey("last_seen"), ">", SearchValue(dt)),
                "last_seen():>2024-01-15T12:00:00+00:00",
            ),
            (
                SearchFilter(SearchKey("user_count"), ">", SearchValue("5")),
                "count_unique(user):>5",
            ),
        ]
        for sf, expected in cases:
            assert search_filters_to_query_string([sf]) == expected, (
                f"Failed for {sf.key.name}:{sf.operator}{sf.value.raw_value}"
            )

    def test_error_unhandled_translation(self):
        # error.unhandled:1 → looking for unhandled → !error.handled:1
        assert (
            search_filters_to_query_string(
                [SearchFilter(SearchKey("error.unhandled"), "=", SearchValue("1"))]
            )
            == "!error.handled:1"
        )
        # error.unhandled:0 → looking for handled → error.handled:1
        assert (
            search_filters_to_query_string(
                [SearchFilter(SearchKey("error.unhandled"), "=", SearchValue("0"))]
            )
            == "error.handled:1"
        )
        # !error.unhandled:1 → looking for handled → error.handled:1
        assert (
            search_filters_to_query_string(
                [SearchFilter(SearchKey("error.unhandled"), "!=", SearchValue("1"))]
            )
            == "error.handled:1"
        )

    def test_error_main_thread_key_translated(self):
        filters = [SearchFilter(SearchKey("error.main_thread"), "=", SearchValue("1"))]
        assert search_filters_to_query_string(filters) == "exception_main_thread:1"

    def test_realistic_mixed_query(self):
        filters = [
            SearchFilter(SearchKey("level"), "=", SearchValue("error")),
            SearchFilter(SearchKey("error.unhandled"), "=", SearchValue("1")),
            SearchFilter(SearchKey("times_seen"), ">", SearchValue("50")),
            SearchFilter(SearchKey("platform"), "IN", SearchValue(["python", "javascript"])),
            SearchFilter(SearchKey("release.version"), ">", SearchValue("2.0.0")),
            SearchFilter(SearchKey("tags[browser]"), "=", SearchValue("chrome")),
        ]
        result = search_filters_to_query_string(filters)
        assert result == (
            "level:error !error.handled:1 count():>50"
            " platform:[python, javascript] tags[browser]:chrome"
        )


class TestRunEAPGroupSearch(TestCase, SnubaTestCase, OccurrenceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = datetime.now(timezone.utc)
        self.start = self.now - timedelta(hours=1)
        self.end = self.now + timedelta(hours=1)

        self.group1 = self.create_group(project=self.project)
        self.group2 = self.create_group(project=self.project)

        # Store 3 error occurrences for group1, 1 warning for group2
        for _ in range(3):
            occ = self.create_eap_occurrence(
                group_id=self.group1.id,
                level="error",
                timestamp=self.now - timedelta(minutes=5),
            )
            self.store_eap_items([occ])

        occ = self.create_eap_occurrence(
            group_id=self.group2.id,
            level="warning",
            timestamp=self.now - timedelta(minutes=10),
        )
        self.store_eap_items([occ])

    def test_last_seen_sort(self) -> None:
        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="last_seen",
            organization=self.organization,
            referrer="test",
        )
        group_ids = [gid for gid, _ in result]
        assert len(group_ids) == 2
        assert group_ids[0] == self.group1.id
        assert group_ids[1] == self.group2.id

    def test_times_seen_sort(self) -> None:
        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="times_seen",
            organization=self.organization,
            referrer="test",
        )
        group_ids = [gid for gid, _ in result]
        assert len(group_ids) == 2
        assert group_ids[0] == self.group1.id
        assert group_ids[1] == self.group2.id

    def test_first_seen_sort(self) -> None:
        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="first_seen",
            organization=self.organization,
            referrer="test",
        )
        group_ids = [gid for gid, _ in result]
        assert len(group_ids) == 2
        assert group_ids[0] == self.group1.id
        assert group_ids[1] == self.group2.id

    def test_user_count_sort(self) -> None:
        group3 = self.create_group(project=self.project)
        for i in range(3):
            occ = self.create_eap_occurrence(
                group_id=group3.id,
                level="error",
                timestamp=self.now - timedelta(minutes=3),
                tags={"sentry:user": f"user-{i}@example.com"},
            )
            self.store_eap_items([occ])

        occ = self.create_eap_occurrence(
            group_id=self.group1.id,
            level="error",
            timestamp=self.now - timedelta(minutes=3),
            tags={"sentry:user": "only-user@example.com"},
        )
        self.store_eap_items([occ])

        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="user_count",
            organization=self.organization,
            referrer="test",
        )
        group_ids = [gid for gid, _ in result]
        assert len(group_ids) == 2
        assert group_ids[0] == group3.id
        assert group_ids[1] == self.group1.id

    def test_unsupported_sort_returns_empty(self) -> None:
        result, total = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="trends",
            organization=self.organization,
            referrer="test",
        )
        assert result == []
        assert total == 0

    def test_filter_narrows_results(self) -> None:
        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="last_seen",
            organization=self.organization,
            search_filters=[SearchFilter(SearchKey("level"), "=", SearchValue("error"))],
            referrer="test",
        )
        group_ids = {gid for gid, _ in result}
        assert group_ids == {self.group1.id}

    def test_group_id_pre_filter(self) -> None:
        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="last_seen",
            organization=self.organization,
            group_ids=[self.group1.id],
            referrer="test",
        )
        assert {gid for gid, _ in result} == {self.group1.id}

    def test_environment_filter(self) -> None:
        env = self.create_environment(project=self.project, name="production")
        occ = self.create_eap_occurrence(
            group_id=self.group1.id,
            level="error",
            environment="production",
            timestamp=self.now - timedelta(minutes=2),
        )
        self.store_eap_items([occ])

        occ2 = self.create_eap_occurrence(
            group_id=self.group2.id,
            level="warning",
            environment="staging",
            timestamp=self.now - timedelta(minutes=2),
        )
        self.store_eap_items([occ2])

        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=[env.id],
            sort_field="last_seen",
            organization=self.organization,
            referrer="test",
        )
        group_ids = {gid for gid, _ in result}
        assert self.group1.id in group_ids
        assert self.group2.id not in group_ids

    def test_sort_and_filter(self) -> None:
        group3 = self.create_group(project=self.project)
        for i in range(5):
            occ = self.create_eap_occurrence(
                group_id=group3.id,
                level="error",
                timestamp=self.now - timedelta(minutes=1 + i),
            )
            self.store_eap_items([occ])

        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="times_seen",
            organization=self.organization,
            group_ids=[self.group1.id, group3.id],
            search_filters=[SearchFilter(SearchKey("level"), "=", SearchValue("error"))],
            referrer="test",
        )
        group_ids = [gid for gid, _ in result]
        assert len(group_ids) == 2
        assert group_ids[0] == group3.id
        assert group_ids[1] == self.group1.id
        assert self.group2.id not in group_ids
