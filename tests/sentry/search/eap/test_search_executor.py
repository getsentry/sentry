from datetime import datetime, timedelta, timezone

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.search.eap.occurrences.search_executor import (
    run_eap_group_search,
    search_filters_to_query_string,
)
from sentry.testutils.cases import OccurrenceTestCase, SnubaTestCase, TestCase
from sentry.utils.cursors import Cursor


class TestSearchFiltersToQueryString:
    def test_all_operator_types(self):
        cases = [
            (SearchFilter(SearchKey("level"), "=", SearchValue("error")), "level:error"),
            (SearchFilter(SearchKey("level"), "!=", SearchValue("error")), "!level:error"),
            (
                SearchFilter(SearchKey("exception_count"), ">", SearchValue("5")),
                "exception_count:>5",
            ),
            (
                SearchFilter(SearchKey("exception_count"), ">=", SearchValue("5")),
                "exception_count:>=5",
            ),
            (
                SearchFilter(SearchKey("exception_count"), "<", SearchValue("5")),
                "exception_count:<5",
            ),
            (
                SearchFilter(SearchKey("exception_count"), "<=", SearchValue("5")),
                "exception_count:<=5",
            ),
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
            (
                SearchFilter(SearchKey("exception_count"), "=", SearchValue(42)),
                "exception_count:42",
            ),
            (
                SearchFilter(SearchKey("exception_count"), ">", SearchValue(3.14)),
                "exception_count:>3.14",
            ),
            # Datetime values
            (
                SearchFilter(SearchKey("timestamp"), ">", SearchValue(dt)),
                "timestamp:>2024-01-15T12:00:00+00:00",
            ),
            # User-defined tags are wrapped as `tags[...]` so the SearchResolver
            # parses them as tag filters. OCCURRENCE_DEFINITIONS.alias_to_column
            # maps the tag name to `attr[{name}]` at resolve time to match EAP's
            # ingestion format.
            (
                SearchFilter(SearchKey("tags[browser]"), "=", SearchValue("chrome")),
                "tags[browser]:chrome",
            ),
            (
                SearchFilter(SearchKey("service"), "=", SearchValue("api-gateway")),
                "tags[service]:api-gateway",
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
        result, total = run_eap_group_search(
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
        assert total == 2

    def test_times_seen_sort(self) -> None:
        result, total = run_eap_group_search(
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
        assert total == 2

    def test_first_seen_sort(self) -> None:
        result, total = run_eap_group_search(
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
        assert total == 2

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

        result, total = run_eap_group_search(
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
        assert total == 3

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
        result, total = run_eap_group_search(
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
        assert total == 1

    def test_group_id_pre_filter(self) -> None:
        result, total = run_eap_group_search(
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
        assert total == 1

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

        result, total = run_eap_group_search(
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
        assert total == 1

    def test_sort_and_filter(self) -> None:
        group3 = self.create_group(project=self.project)
        for i in range(5):
            occ = self.create_eap_occurrence(
                group_id=group3.id,
                level="error",
                timestamp=self.now - timedelta(minutes=1 + i),
            )
            self.store_eap_items([occ])

        result, total = run_eap_group_search(
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
        assert total == 2

    def test_total_with_aggregation_filter(self) -> None:
        # setUp: group1 has 3 occurrences, group2 has 1.
        # With times_seen:>2 only group1 passes.
        result, total = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="times_seen",
            organization=self.organization,
            search_filters=[SearchFilter(SearchKey("times_seen"), ">", SearchValue("2"))],
            referrer="test",
        )
        group_ids = {gid for gid, _ in result}
        assert group_ids == {self.group1.id}
        assert total == 1

    def test_cursor_next_page_filters_by_score(self) -> None:
        # First: get the actual last_seen scores from an unfiltered query.
        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="last_seen",
            organization=self.organization,
            referrer="test",
        )
        assert len(result) == 2
        # group1 has the higher score (more recent). Use group2's score as the
        # cursor — the "next page" should exclude group1 (score > cursor) but
        # include group2 (score == cursor).
        group2_score = next(score for gid, score in result if gid == self.group2.id)

        cursor_result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="last_seen",
            organization=self.organization,
            cursor=Cursor(value=group2_score, offset=0, is_prev=False),
            referrer="test",
        )
        cursor_group_ids = {gid for gid, _ in cursor_result}
        assert cursor_group_ids == {self.group2.id}

    def test_cursor_prev_page_filters_by_score(self) -> None:
        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="last_seen",
            organization=self.organization,
            referrer="test",
        )
        group1_score = next(score for gid, score in result if gid == self.group1.id)

        cursor_result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="last_seen",
            organization=self.organization,
            cursor=Cursor(value=group1_score, offset=0, is_prev=True),
            referrer="test",
        )
        cursor_group_ids = {gid for gid, _ in cursor_result}
        # Only group1 has score >= group1_score
        assert cursor_group_ids == {self.group1.id}

    def test_last_seen_score_is_milliseconds(self) -> None:
        result, _ = run_eap_group_search(
            start=self.start,
            end=self.end,
            project_ids=[self.project.id],
            environment_ids=None,
            sort_field="last_seen",
            organization=self.organization,
            referrer="test",
        )
        group1_score = next(score for gid, score in result if gid == self.group1.id)
        # group1's newest event is self.now - 5min. In ms that's ~1.7e12; in
        # seconds it would be ~1.7e9. Only the ms range matches reality.
        assert group1_score >= 10**12
        expected_ms = int((self.now - timedelta(minutes=5)).timestamp() * 1000)
        assert abs(group1_score - expected_ms) < 2000
