from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from django.utils import timezone

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.issue_search import convert_query_values, parse_search_query
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.search.snuba.backend import EventsDatasetSnubaSearchBackend
from sentry.search.snuba.executors import (
    DEFAULT_TRENDS_WEIGHTS,
    InvalidQueryForExecutor,
    PostgresSnubaQueryExecutor,
    PostgresSortStrategy,
)
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel


def _patch_pg_strategies(strategies: dict[str, PostgresSortStrategy]):
    return mock.patch.object(
        PostgresSnubaQueryExecutor,
        "postgres_sort_strategies",
        new_callable=lambda: property(lambda self: strategies),
    )


def _ts_strategy(**overrides: Any) -> PostgresSortStrategy:
    defaults: dict[str, Any] = dict(
        postgres_fields={"ts": "seer_autofix_last_triggered"},
        score_fn=lambda data: data["ts"].timestamp(),
    )
    defaults.update(overrides)
    return PostgresSortStrategy(**defaults)


class TestPostgresSortStrategy(TestCase):
    def test_defaults(self):
        s = PostgresSortStrategy(postgres_fields={"ts": "last_seen"})
        assert s.snuba_aggregations == []
        assert s.signal_resolvers == {}
        assert s.exclude_null_postgres is True


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
        search_filters: list[Any] = []
        if query:
            search_filters = list(
                convert_query_values(parse_search_query(query), [self.project], self.user, None)
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


class TestPostgresSortWithoutSnuba(PostgresSortTestBase):
    """Sorts with no Snuba aggregations/filters: scored in memory, no Snuba call."""

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

    def test_respects_time_window_without_snuba(self):
        # last_seen: groups[0] ~8d ago, groups[1] ~5d ago, groups[2] ~3d ago.
        # A 4-day window should drop the two older groups even though Snuba is skipped.
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            results = list(
                self.backend.query(
                    [self.project],
                    search_filters=[],
                    environments=None,
                    count_hits=False,
                    sort_by="test_sort",
                    date_from=before_now(days=4),
                    date_to=None,
                    cursor=None,
                    referrer=Referrer.TESTING_TEST,
                )
            )
        assert results == [self.groups[2]]

    def test_skips_snuba_without_filters_or_aggregations(self):
        with _patch_pg_strategies({"test_sort": _ts_strategy()}):
            with mock.patch.object(PostgresSnubaQueryExecutor, "snuba_search") as snuba_spy:
                results = list(self.make_query("test_sort"))
                assert len(results) == 3
                assert not snuba_spy.called

    def test_numeric_column_via_score_fn(self):
        for group, score in zip(self.groups, [0.1, 0.9, 0.5]):
            group.seer_fixability_score = score
            group.save()
        strategy = PostgresSortStrategy(
            postgres_fields={"fix": "seer_fixability_score"},
            score_fn=lambda data: data["fix"],
        )
        with _patch_pg_strategies({"test_sort": strategy}):
            results = list(self.make_query("test_sort"))
        assert results == [self.groups[1], self.groups[2], self.groups[0]]


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
            score_fn=lambda data: data["ts"].timestamp() + data.get("last_seen", 0),
        )
        with _patch_pg_strategies({"test_sort": strategy}):
            results = list(self.make_query("test_sort", query="issue"))
        assert len(results) == 3

    def test_aggregate_kwargs_forwarded_to_snuba(self):
        # Caller-supplied trend sort weights must reach Snuba through the Postgres sort
        # path, otherwise hybrid aggregations (trends/recommended) silently score with
        # default weights regardless of what the caller requested.
        weights = DEFAULT_TRENDS_WEIGHTS.copy()
        weights["relative_volume"] = 10
        strategy = _ts_strategy(snuba_aggregations=["last_seen"])
        with _patch_pg_strategies({"test_sort": strategy}):
            with mock.patch.object(
                PostgresSnubaQueryExecutor,
                "snuba_search",
                return_value=([(g.id, 1) for g in self.groups], len(self.groups)),
            ) as snuba_spy:
                self.backend.query(
                    [self.project],
                    search_filters=[],
                    environments=None,
                    count_hits=False,
                    sort_by="test_sort",
                    date_from=None,
                    date_to=None,
                    cursor=None,
                    aggregate_kwargs=weights,
                    referrer=Referrer.TESTING_TEST,
                )
        assert snuba_spy.call_args.kwargs["aggregate_kwargs"] == weights

    def test_invalid_snuba_aggregation_raises(self):
        # A strategy whose snuba_aggregations name isn't a known aggregation must fail
        # loudly rather than with an opaque KeyError during query construction.
        strategy = _ts_strategy(snuba_aggregations=["not_a_real_aggregation"])
        with _patch_pg_strategies({"test_sort": strategy}):
            with pytest.raises(InvalidQueryForExecutor):
                list(self.make_query("test_sort"))

    def test_signal_resolver_influences_score(self):
        boosted = self.groups[0].id
        strategy = _ts_strategy(
            signal_resolvers={"boost": lambda actor, org, gids: {boosted: 1}},
            score_fn=lambda data: data.get("boost", 0) * 10**15 + data["ts"].timestamp(),
        )
        with _patch_pg_strategies({"test_sort": strategy}):
            results = list(self.make_query("test_sort"))
        # groups[0] is the oldest (normally last) but the boost floats it to the top.
        assert results == [self.groups[0], self.groups[2], self.groups[1]]

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
    def test_too_many_candidates_returns_none(self):
        executor = PostgresSnubaQueryExecutor()
        qs = Group.objects.filter(project=self.project)
        with mock.patch("sentry.search.snuba.executors.options") as mock_opts:
            mock_opts.get.return_value = 0
            result = executor._execute_postgres_sort(
                strategy=_ts_strategy(snuba_aggregations=["last_seen"]),
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

    def test_overflow_fallback_uses_chunked_path_not_shortcut(self):
        # A Postgres sort with no Snuba equivalent that overflows falls back to `date`,
        # but must go through the chunked Snuba path (which hides non-default issue types),
        # not the postgres-only shortcut that skips type-visibility filtering. The chunked
        # path calls snuba_search; the shortcut does not.
        with (
            _patch_pg_strategies({"test_sort": _ts_strategy()}),
            override_options({"snuba.search.max-pre-snuba-candidates": 0}),
            mock.patch.object(
                PostgresSnubaQueryExecutor,
                "snuba_search",
                return_value=([(g.id, 1) for g in self.groups], len(self.groups)),
            ) as snuba_spy,
        ):
            list(self.make_query("test_sort"))
        assert snuba_spy.called

    def test_overflow_with_date_key_skips_shortcut(self):
        # A Postgres strategy registered under "date" that overflows must still go through
        # the chunked path, not the postgres-only date shortcut. "date" is in
        # sort_strategies, so the fallback keeps sort_by="date" -- the shortcut guard must
        # not depend on the key being absent from sort_strategies.
        with (
            _patch_pg_strategies({"date": _ts_strategy()}),
            override_options({"snuba.search.max-pre-snuba-candidates": 0}),
            mock.patch.object(
                PostgresSnubaQueryExecutor,
                "snuba_search",
                return_value=([(g.id, 1) for g in self.groups], len(self.groups)),
            ) as snuba_spy,
        ):
            list(self.make_query("date"))
        assert snuba_spy.called

    def test_overflow_with_postgres_only_key_falls_back_to_date(self):
        # "inbox" is in sort_strategies but maps to "" (a Postgres-only sort with no Snuba
        # aggregation). On overflow the fallback must rewrite it to `date` rather than flow
        # the empty sort_field into the Snuba aggregation lookup (which would KeyError).
        with (
            _patch_pg_strategies({"inbox": _ts_strategy()}),
            override_options({"snuba.search.max-pre-snuba-candidates": 0}),
            mock.patch.object(
                PostgresSnubaQueryExecutor,
                "snuba_search",
                return_value=([(g.id, 1) for g in self.groups], len(self.groups)),
            ) as snuba_spy,
        ):
            list(self.make_query("inbox"))
        assert snuba_spy.call_args.kwargs["sort_field"] == "last_seen"

    def test_unregistered_sort_uses_snuba_path(self):
        # `date` isn't a Postgres strategy, so it takes the existing Snuba path unchanged.
        results = list(self.make_query("date"))
        assert len(results) == 3


class TestRecommendedV2Sort(PostgresSortTestBase):
    """recommended_v2: Snuba recommended base score plus additive boosts for viewer
    assignment, Seer fixability, and Seer agent progress.

    The base fixture's groups have events ~8d, ~5d, and ~3d old, so the recency-driven
    base score orders them [2, 1, 0] with small (<0.03) differences -- each boost below
    is large enough to override that.
    """

    def _query(self, actor=None):
        return list(
            self.backend.query(
                [self.project],
                search_filters=[],
                environments=None,
                count_hits=False,
                sort_by="recommended_v2",
                date_from=None,
                date_to=None,
                cursor=None,
                actor=actor,
                referrer=Referrer.TESTING_TEST,
            )
        )

    def test_assignment_ordering(self):
        team = self.create_team(organization=self.organization, members=[self.user])
        GroupAssignee.objects.assign(self.groups[0], self.user)
        GroupAssignee.objects.assign(self.groups[1], team)

        # Without a viewer, assignment contributes nothing and recency wins.
        assert self._query(actor=None) == [self.groups[2], self.groups[1], self.groups[0]]
        # Individual assignment outranks team assignment outranks unassigned.
        assert self._query(actor=self.user) == [self.groups[0], self.groups[1], self.groups[2]]

    def test_fixability_boost(self):
        self.groups[0].update(seer_fixability_score=1.0)

        results = self._query(actor=self.user)
        assert results[0] == self.groups[0]
        # Groups without a fixability score are still included, just unboosted.
        assert set(results) == set(self.groups)

    def test_agent_progress_boost(self):
        # A later Seer stage outranks an earlier one, which outranks no agent activity.
        self.create_group_activity(group=self.groups[0], type=ActivityType.SEER_PR_CREATED.value)
        self.create_group_activity(group=self.groups[1], type=ActivityType.SEER_RCA_COMPLETED.value)

        assert self._query(actor=self.user) == [self.groups[0], self.groups[1], self.groups[2]]

    def test_agent_boost_reset_by_regression(self):
        # groups[0] reached PR-created but then regressed: that progress is stale.
        self.create_group_activity(
            group=self.groups[0],
            type=ActivityType.SEER_PR_CREATED.value,
            datetime=before_now(hours=2),
        )
        self.create_group_activity(
            group=self.groups[0],
            type=ActivityType.SET_REGRESSION.value,
            datetime=before_now(hours=1),
        )
        # groups[1] reached a (lesser) stage after its regression: still counts.
        self.create_group_activity(
            group=self.groups[1],
            type=ActivityType.SET_REGRESSION.value,
            datetime=before_now(hours=2),
        )
        self.create_group_activity(
            group=self.groups[1],
            type=ActivityType.SEER_RCA_COMPLETED.value,
            datetime=before_now(hours=1),
        )

        assert self._query(actor=self.user) == [self.groups[1], self.groups[2], self.groups[0]]


class TestDefaultPostgresSortStrategies(TestCase):
    def test_recommended_v2_registered(self):
        strategies = PostgresSnubaQueryExecutor().postgres_sort_strategies
        assert set(strategies) == {"recommended_v2"}
        strategy = strategies["recommended_v2"]
        assert strategy.snuba_aggregations == ["recommended"]
        assert strategy.exclude_null_postgres is False
        assert set(strategy.signal_resolvers) == {"assignment", "agent"}
