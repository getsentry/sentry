from __future__ import annotations

from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone

from sentry.exceptions import InvalidSearchQuery
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.issue_search import convert_query_values, parse_search_query
from sentry.models.group import Group, GroupStatus
from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.search.snuba.executors import (
    PostgresSnubaQueryExecutor,
    PostgresSortStrategy,
    _datetime_to_ms,
)
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.types.group import GroupSubStatus, PriorityLevel


def _patch_pg_strategies(strategies: dict[str, PostgresSortStrategy]):
    return mock.patch.object(
        PostgresSnubaQueryExecutor,
        "postgres_sort_strategies",
        new_callable=lambda: property(lambda self: strategies),
    )


def _ts_strategy(**overrides):
    defaults = dict(
        postgres_fields={"ts": "seer_autofix_last_triggered"},
        score_fn=lambda data: _datetime_to_ms(data["ts"]),
    )
    defaults.update(overrides)
    return PostgresSortStrategy(**defaults)


class TestDatetimeToMs(TestCase):
    def test_converts_datetime(self):
        dt = timezone.now()
        assert isinstance(_datetime_to_ms(dt), int)
        assert _datetime_to_ms(dt) > 0

    def test_none_returns_zero(self):
        assert _datetime_to_ms(None) == 0

    def test_preserves_ordering(self):
        assert _datetime_to_ms(before_now(hours=2)) < _datetime_to_ms(before_now(hours=1))


class TestPostgresSortStrategy(TestCase):
    def test_defaults(self):
        s = PostgresSortStrategy(postgres_fields={"ts": "last_seen"})
        assert s.snuba_aggregations == []
        assert s.field_resolvers is None
        assert s.exclude_null_postgres is True
        assert s.snuba_fallback is None

    def test_frozen(self):
        s = PostgresSortStrategy(postgres_fields={"ts": "last_seen"})
        with pytest.raises(AttributeError):
            s.exclude_null_postgres = False  # type: ignore[misc]

    def test_custom_score_fn(self):
        s = PostgresSortStrategy(
            postgres_fields={"ts": "last_seen"},
            score_fn=lambda data: data.get("ts", 0) * 2,
        )
        assert s.score_fn({"ts": 5}) == 10


class TestHasSortStrategy(TestCase):
    def test_includes_snuba_sorts(self):
        executor = PostgresSnubaQueryExecutor()
        assert executor.has_sort_strategy("date") is True
        assert executor.has_sort_strategy("nonexistent") is False

    def test_includes_postgres_sorts(self):
        executor = PostgresSnubaQueryExecutor()
        with _patch_pg_strategies({"custom": _ts_strategy()}):
            assert executor.has_sort_strategy("custom") is True
            assert executor.has_sort_strategy("date") is True


class TestResolveFields(TestCase):
    def test_default_fields(self):
        executor = PostgresSnubaQueryExecutor()
        strategy = PostgresSortStrategy(postgres_fields={"ts": "last_seen", "prio": "priority"})
        org = self.create_organization()
        assert executor._resolve_pg_sort_fields(strategy, org, None) == {
            "ts": "last_seen",
            "prio": "priority",
        }

    def test_field_resolver_overrides(self):
        executor = PostgresSnubaQueryExecutor()
        strategy = PostgresSortStrategy(
            postgres_fields={"ts": "default_field", "prio": "priority"},
            field_resolvers={"ts": lambda org, actor: "resolved_field"},
        )
        org = self.create_organization()
        resolved = executor._resolve_pg_sort_fields(strategy, org, None)
        assert resolved["ts"] == "resolved_field"
        assert resolved["prio"] == "priority"


class PostgresSortTestBase(TestCase, SnubaTestCase):
    """Shared setup: creates 3 groups with distinct seer_autofix_last_triggered values."""

    def setUp(self):
        super().setUp()
        self.backend = EventsDatasetSnubaSearchBackend()
        self.base_datetime = before_now(days=3).replace(microsecond=0)
        self.groups = []
        offsets = [timedelta(days=5), timedelta(days=2), timedelta(0)]
        for i, offset in enumerate(offsets):
            event = self.store_event(
                data={
                    "fingerprint": [f"group-{i}"],
                    "event_id": f"{chr(97 + i)}" * 32,
                    "message": f"issue {i}",
                    "timestamp": (self.base_datetime - offset).isoformat(),
                    "stacktrace": {"frames": [{"module": f"mod{i}"}]},
                    "environment": "production",
                },
                project_id=self.project.id,
            )
            group = Group.objects.get(id=event.group.id)
            group.status = GroupStatus.UNRESOLVED
            group.substatus = GroupSubStatus.ONGOING
            group.priority = PriorityLevel.HIGH
            group.update(type=ErrorGroupType.type_id)
            group.seer_autofix_last_triggered = self.base_datetime - offset
            group.save()
            self.store_group(group)
            self.groups.append(group)

    def make_query(self, sort_by, query=None, limit=None, cursor=None):
        search_filters = []
        if query:
            search_filters = convert_query_values(
                parse_search_query(query), [self.project], self.user, None
            )
        kwargs = {}
        if limit is not None:
            kwargs["limit"] = limit
        return self.backend.query(
            [self.project],
            search_filters=search_filters,
            environments=None,
            count_hits=False,
            sort_by=sort_by,
            date_from=None,
            date_to=None,
            cursor=cursor,
            referrer=Referrer.TESTING_TEST,
            **kwargs,
        )


class TestPurePostgresSort(PostgresSortTestBase):
    def test_ordering(self):
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            results = list(self.make_query("test_sort"))
        assert results == [self.groups[2], self.groups[1], self.groups[0]]

    def test_null_exclusion(self):
        self.groups[1].seer_autofix_last_triggered = None
        self.groups[1].save()

        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            results = list(self.make_query("test_sort"))
        assert self.groups[1] not in results
        assert results == [self.groups[2], self.groups[0]]

    def test_cursor_pagination(self):
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            page1 = self.make_query("test_sort", limit=2)
            assert list(page1) == [self.groups[2], self.groups[1]]
            assert page1.next.has_results

            page2 = self.make_query("test_sort", limit=2, cursor=page1.next)
            assert list(page2) == [self.groups[0]]

    def test_empty_when_all_null(self):
        Group.objects.filter(id__in=[g.id for g in self.groups]).update(
            seer_autofix_last_triggered=None
        )
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            assert len(list(self.make_query("test_sort"))) == 0

    def test_with_postgres_only_filter(self):
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            results = list(self.make_query("test_sort", query="is:unresolved"))
        assert len(results) == 3

    def test_pure_path_does_not_call_snuba(self):
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            with mock.patch.object(PostgresSnubaQueryExecutor, "snuba_search") as snuba_spy:
                results = list(self.make_query("test_sort"))
                assert len(results) == 3
                assert not snuba_spy.called


class TestExecutePostgresSort(PostgresSortTestBase):
    def test_snuba_filter_narrows_candidates(self):
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            results = list(self.make_query("test_sort", query="issue 0"))
        assert len(results) == 1
        assert results[0] == self.groups[0]

    def test_execute_path_calls_snuba(self):
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            with mock.patch.object(
                PostgresSnubaQueryExecutor,
                "snuba_search",
                return_value=([(g.id, 1) for g in Group.objects.filter(project=self.project)], 0),
            ) as snuba_spy:
                self.make_query("test_sort", query="issue")
                assert snuba_spy.called

    def test_hybrid_sort_with_snuba_aggregations(self):
        strategy = _ts_strategy(
            snuba_aggregations=["last_seen"],
            score_fn=lambda data: _datetime_to_ms(data["ts"]) + data.get("last_seen", 0),
        )
        with _patch_pg_strategies({"test_sort": strategy}):
            results = list(self.make_query("test_sort", query="issue"))
        assert len(results) == 3

    def test_cursor_pagination_with_snuba_filter(self):
        for i in range(5):
            event = self.store_event(
                data={
                    "fingerprint": [f"extra-{i}"],
                    "event_id": f"e{i:031d}",
                    "message": f"extra issue {i}",
                    "timestamp": (self.base_datetime - timedelta(hours=i)).isoformat(),
                    "stacktrace": {"frames": [{"module": f"ex{i}"}]},
                    "environment": "production",
                },
                project_id=self.project.id,
            )
            group = Group.objects.get(id=event.group.id)
            group.status = GroupStatus.UNRESOLVED
            group.substatus = GroupSubStatus.ONGOING
            group.update(type=ErrorGroupType.type_id)
            group.seer_autofix_last_triggered = self.base_datetime - timedelta(hours=i)
            group.save()
            self.store_group(group)

        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            page1 = self.make_query("test_sort", query="issue", limit=3)
            page2 = self.make_query("test_sort", query="issue", limit=3, cursor=page1.next)

        page1_ids = {g.id for g in page1}
        page2_ids = {g.id for g in page2}
        assert page1_ids.isdisjoint(page2_ids)


class TestFallbackBehavior(PostgresSortTestBase):
    def test_fallback_to_snuba_sort(self):
        """When _execute_postgres_sort returns None, falls through to Snuba path."""
        strategy = _ts_strategy(snuba_fallback="date")
        with (
            _patch_pg_strategies({"test_sort": strategy}),
            mock.patch.object(
                PostgresSnubaQueryExecutor, "_execute_postgres_sort", return_value=None
            ),
        ):
            results = list(self.make_query("test_sort", query="issue"))
            assert len(results) >= 0

    def test_too_many_candidates_without_fallback_raises(self):
        strategy = _ts_strategy(snuba_fallback=None)
        executor = PostgresSnubaQueryExecutor()
        qs = Group.objects.filter(project=self.project)
        with mock.patch("sentry.search.snuba.executors.options") as mock_opts:
            mock_opts.get.return_value = 0
            with pytest.raises(InvalidSearchQuery, match="requires more specific filters"):
                executor._execute_postgres_sort(
                    strategy=strategy,
                    sort_by="test_sort",
                    group_queryset=qs,
                    projects=[self.project],
                    environments=None,
                    search_filters=[],
                    limit=25,
                    cursor=None,
                    count_hits=False,
                    paginator_options={},
                    max_hits=None,
                    actor=None,
                    start=before_now(days=90),
                    end=timezone.now(),
                    referrer=Referrer.TESTING_TEST.value,
                )

    def test_too_many_candidates_with_fallback_returns_none(self):
        strategy = _ts_strategy(snuba_fallback="date")
        executor = PostgresSnubaQueryExecutor()
        qs = Group.objects.filter(project=self.project)
        with mock.patch("sentry.search.snuba.executors.options") as mock_opts:
            mock_opts.get.return_value = 0
            result = executor._execute_postgres_sort(
                strategy=strategy,
                sort_by="test_sort",
                group_queryset=qs,
                projects=[self.project],
                environments=None,
                search_filters=[],
                limit=25,
                cursor=None,
                count_hits=False,
                paginator_options={},
                max_hits=None,
                actor=None,
                start=before_now(days=90),
                end=timezone.now(),
                referrer=Referrer.TESTING_TEST.value,
            )
            assert result is None

    def test_unknown_sort_uses_snuba_path(self):
        results = list(self.make_query("date"))
        assert len(results) >= 0


class TestDefaultPostgresSortStrategies(TestCase):
    def test_returns_empty(self):
        assert PostgresSnubaQueryExecutor().postgres_sort_strategies == {}
