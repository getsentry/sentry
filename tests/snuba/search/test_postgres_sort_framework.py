from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from django.utils import timezone

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.issue_search import convert_query_values, parse_search_query
from sentry.models.environment import Environment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
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

    def make_query(
        self, sort_by, query=None, limit=None, cursor=None, date_to=None, environments=None
    ):
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
            environments=environments,
            count_hits=False,
            sort_by=sort_by,
            date_from=None,
            date_to=date_to,
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

    def test_score_fn_error_falls_back_not_drops(self):
        # A score_fn that raises on one row must not 500 the whole sort, and the issue must
        # not vanish from the stream: it falls back to fallback_score_fn and stays in the
        # results. Regression for an OverflowError in the recommended_v2 newness boost that
        # took down the entire issue stream.
        for group in self.groups:
            group.update(seer_fixability_score=float(group.id))
        bad_id = self.groups[0].id

        def score_fn(data):
            if data["fix"] == bad_id:
                raise OverflowError("boom")
            return data["fix"]

        strategy = PostgresSortStrategy(
            postgres_fields={"fix": "seer_fixability_score"},
            score_fn=score_fn,
            # groups[0] fails score_fn but falls back to a high base score, so it survives
            # and sorts to the top rather than being dropped.
            fallback_score_fn=lambda data: 10**9,
            exclude_null_postgres=False,
        )
        with _patch_pg_strategies({"test_sort": strategy}):
            results = list(self.make_query("test_sort"))
        assert set(results) == set(self.groups)
        assert results[0] == self.groups[0]


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
            signal_resolvers={"boost": lambda actor, org, projects, gids: {boosted: 1}},
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
                native_upper_bound_ok=True,
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
    relevance (assignment or suspect commit), Seer fixability, Seer agent progress,
    regressed issues, and newly-seen issues.

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

    def test_regressed_boost(self):
        # groups[0] has the lowest base score (oldest events); marking it regressed lifts
        # it above the others, which stay ONGOING.
        self.groups[0].update(substatus=GroupSubStatus.REGRESSED)

        assert self._query(actor=self.user)[0] == self.groups[0]

    def test_newness_boost(self):
        # groups[0] is last by activity-based recency, but just appeared for the first time.
        # The first_seen-based newness boost (distinct from last_seen recency) lifts it up.
        self.groups[0].update(first_seen=before_now(hours=1))

        assert self._query(actor=self.user)[0] == self.groups[0]

    def test_very_old_first_seen_does_not_overflow(self):
        # first_seen far enough back that hours/halflife exceeds ~1024 used to overflow
        # the float in 1.0 / 2.0**x. The query must still succeed (newness underflows to 0).
        self.groups[0].update(first_seen=before_now(days=3000))

        assert set(self._query(actor=self.user)) == set(self.groups)

    def _add_suspect_commit(self, group, user):
        GroupOwner.objects.create(
            group=group,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=user.id,
        )

    def test_suspect_commit_boost(self):
        # groups[0] has the lowest base score; the viewer authored its suspect commit,
        # which lifts it to the top even though it isn't assigned to them.
        self._add_suspect_commit(self.groups[0], self.user)

        assert self._query(actor=self.user)[0] == self.groups[0]

    def test_relevance_is_max_not_sum(self):
        # groups[0] is both assigned to the viewer and authored by them; groups[1] is only
        # assigned to them. If the two relevance signals summed, groups[0] would win; because
        # they're combined with max(), both get the same boost and the higher base (groups[1])
        # stays ahead.
        GroupAssignee.objects.assign(self.groups[0], self.user)
        self._add_suspect_commit(self.groups[0], self.user)
        GroupAssignee.objects.assign(self.groups[1], self.user)

        assert self._query(actor=self.user) == [self.groups[1], self.groups[0], self.groups[2]]


class TestProgressSort(PostgresSortTestBase):
    """progress: primary sort by fix-cycle rank (fix_applied > fix_proposed > diagnosed >
    assigned > identified), secondary by last_seen.

    The base fixture's groups have events ~8d, ~5d, and ~3d old, so on last_seen alone they
    order [2, 1, 0] (newest first).
    """

    def _query(self):
        return list(
            self.backend.query(
                [self.project],
                search_filters=[],
                environments=None,
                count_hits=False,
                sort_by="progress",
                date_from=None,
                date_to=None,
                cursor=None,
                referrer=Referrer.TESTING_TEST,
            )
        )

    def test_rank_outranks_last_seen(self):
        # Give the oldest group the furthest progress and the newest group none: rank must
        # invert the last_seen ordering.
        self.create_group_derived_data(group=self.groups[0], progress="fix_proposed")
        self.create_group_derived_data(group=self.groups[1], progress="diagnosed")
        # groups[2] has no derived data -> identified (lowest rank).
        assert self._query() == [self.groups[0], self.groups[1], self.groups[2]]

    def test_last_seen_breaks_ties_within_rank(self):
        # groups[0] and groups[1] are both diagnosed; the more recently seen (groups[1])
        # sorts first. groups[2] stays identified and sorts last.
        self.create_group_derived_data(group=self.groups[0], progress="diagnosed")
        self.create_group_derived_data(group=self.groups[1], progress="diagnosed")
        assert self._query() == [self.groups[1], self.groups[0], self.groups[2]]

    def test_reads_from_derived_data(self):
        self.create_group_derived_data(group=self.groups[0], progress="identified")
        self.create_group_derived_data(group=self.groups[1], progress="diagnosed")
        self.create_group_derived_data(group=self.groups[2], progress="fix_applied")
        assert self._query() == [self.groups[2], self.groups[1], self.groups[0]]

    def test_derived_data_missing_row_defaults_to_identified(self):
        # Only groups[0] has a derived row; the others default to identified and fall back
        # to last_seen ordering (groups[2] newer than groups[1]).
        self.create_group_derived_data(group=self.groups[0], progress="fix_applied")
        assert self._query() == [self.groups[0], self.groups[2], self.groups[1]]

    def test_last_progressed_at_breaks_ties(self):
        # Both groups have the same rank but different last_progressed_at values;
        # the more recently progressed group sorts first.
        self.create_group_derived_data(
            group=self.groups[0], progress="diagnosed", last_progressed_at=before_now(days=5)
        )
        self.create_group_derived_data(
            group=self.groups[1], progress="diagnosed", last_progressed_at=before_now(days=1)
        )
        # groups[2] has no derived data -> identified (lowest rank), sorts last.
        assert self._query() == [self.groups[1], self.groups[0], self.groups[2]]

    @override_options({"snuba.search.max-pre-snuba-candidates": 0})
    def test_native_ordering_past_candidate_cap(self):
        # With the cap at 0, the in-memory path overflows and (pre-Tier-1) would degrade to a
        # plain last_seen sort. The native ORDER BY must instead rank correctly, exercising all
        # three derived-data states: a normal row, a null-progress row (closed -> fix_applied),
        # and a missing row (-> identified).
        self.create_group_derived_data(group=self.groups[0], progress="diagnosed")
        self.create_group_derived_data(group=self.groups[1], progress=None)
        # groups[2] intentionally has no derived row -> identified (lowest rank).

        # fix_applied (g1) > diagnosed (g0) > identified (g2), independent of last_seen order.
        assert self._query() == [self.groups[1], self.groups[0], self.groups[2]]

        # Paginating the native path must not overlap or drop rows across pages.
        page1 = self.make_query(sort_by="progress", limit=2)
        assert list(page1) == [self.groups[1], self.groups[0]]
        page2 = self.make_query(sort_by="progress", limit=2, cursor=page1.next)
        assert list(page2) == [self.groups[2]]

    @override_options({"snuba.search.max-pre-snuba-candidates": 0})
    def test_native_ordering_paginates_across_score_tie(self):
        # Identical rank + last_progressed_at -> identical score, so ordering falls to the -id
        # tiebreak; paging one-at-a-time across the tie must not drop or duplicate a row.
        ts = before_now(days=2)
        for group in self.groups:
            self.create_group_derived_data(group=group, progress="diagnosed", last_progressed_at=ts)

        expected = sorted(self.groups, key=lambda g: g.id, reverse=True)
        seen = []
        cursor = None
        for _ in self.groups:
            page = self.make_query(sort_by="progress", limit=1, cursor=cursor)
            seen.extend(page)
            cursor = page.next
        assert seen == expected

    @override_options({"snuba.search.max-pre-snuba-candidates": 0})
    def test_environment_scoping_over_cap_uses_inverted_progress_ranking(self):
        # Environment scoping lives in Snuba, so it can't use the Postgres-only native path.
        # Over the cap it instead uses the inverted chunk loop: Postgres walks progress order
        # and Snuba filters each chunk (honoring the environment), so the result is still
        # progress-ranked rather than degrading to recency. All fixture groups are in
        # `production`, so env membership is unchanged and this isolates the ranking.
        self.create_group_derived_data(group=self.groups[0], progress="fix_applied")
        # groups[1]/[2] default to identified; recency breaks their tie (groups[2] newer).
        production = Environment.get_or_create(self.project, "production")
        results = list(self.make_query(sort_by="progress", environments=[production]))
        assert results == [self.groups[0], self.groups[2], self.groups[1]]

    @override_options({"snuba.search.max-pre-snuba-candidates": 0})
    def test_explicit_date_to_over_cap_uses_inverted_path(self):
        # Group.last_seen is the issue's global max event time, not its max within the window,
        # so the native (Postgres-only) path can't honor an upper time bound. Over the cap the
        # inverted chunk loop handles it: Snuba filters each chunk and scopes to in-window
        # events, so a restrictive date_to correctly excludes an out-of-window group while the
        # remaining results are still progress-ranked (not degraded to recency).
        # groups[2] is the newest (last_seen == base_datetime); a date_to before it excludes it.
        self.create_group_derived_data(group=self.groups[0], progress="fix_applied")
        self.create_group_derived_data(group=self.groups[2], progress="diagnosed")
        results = list(
            self.make_query(sort_by="progress", date_to=self.base_datetime - timedelta(days=1))
        )
        # groups[2] is out of window; groups[0] (fix_applied) outranks groups[1] (identified).
        assert results == [self.groups[0], self.groups[1]]

    @override_options({"snuba.search.max-pre-snuba-candidates": 0})
    def test_date_to_now_uses_native_path(self):
        # The issue-stream endpoint always sends date_to=now. That is not a restrictive bound
        # (last_seen can't exceed now), so the native path must still run and rank by progress
        # rather than falling back to recency.
        self.create_group_derived_data(group=self.groups[0], progress="fix_applied")
        results = list(self.make_query(sort_by="progress", date_to=timezone.now()))
        # Progress order: groups[0] (fix_applied) first, then identified by recency.
        assert results == [self.groups[0], self.groups[2], self.groups[1]]

    @override_options({"snuba.search.max-pre-snuba-candidates": 0})
    def test_snuba_filter_over_cap_uses_inverted_progress_ranking(self):
        # Over the candidate cap WITH a Snuba-side filter, the sort no longer degrades to
        # recency: the inverted chunk loop walks GroupDerivedData in progress order (Postgres
        # is the sort authority) and uses Snuba only as a membership filter. The free-text
        # "issue" filter matches all three fixture messages ("issue 0/1/2").
        #
        # Progress order is the reverse of recency here, so a recency fallback would fail the
        # assertion: the oldest group is furthest along (fix_applied), the newest has no
        # progress (identified).
        self.create_group_derived_data(group=self.groups[0], progress="fix_applied")
        self.create_group_derived_data(group=self.groups[1], progress="diagnosed")
        # groups[2] has no derived row -> identified (lowest rank).
        assert list(self.make_query(sort_by="progress", query="issue")) == [
            self.groups[0],
            self.groups[1],
            self.groups[2],
        ]

        # Paginating the inverted path must not overlap or drop rows across pages.
        page1 = self.make_query(sort_by="progress", query="issue", limit=2)
        assert list(page1) == [self.groups[0], self.groups[1]]
        page2 = self.make_query(sort_by="progress", query="issue", limit=2, cursor=page1.next)
        assert list(page2) == [self.groups[2]]

        # Paging backward (is_prev cursor: ASC walk + ">=" bound) must recover page 1.
        prev_page = self.make_query(sort_by="progress", query="issue", limit=2, cursor=page2.prev)
        assert list(prev_page) == [self.groups[0], self.groups[1]]

    @override_options({"snuba.search.max-pre-snuba-candidates": 0})
    def test_snuba_filter_over_cap_paginates_across_score_tie(self):
        # Two groups share a rank and a last_progressed_at that differ only by sub-millisecond
        # microseconds, so their scaled-int scores are identical and ordering falls to the -id
        # tiebreak. The emitted cursor value is the floored integer score, so the inverted path
        # must bound its Postgres walk with FLOOR(score): a raw "score <= cursor_value"
        # comparison would drop the tie member whose sub-ms fraction pushes its raw score above
        # the floored cursor value. Paging one-at-a-time across the tie (under a Snuba filter
        # matching all groups) must not drop or duplicate a row.
        base = before_now(days=2).replace(microsecond=0)
        self.create_group_derived_data(
            group=self.groups[0],
            progress="diagnosed",
            last_progressed_at=base.replace(microsecond=700),
        )
        self.create_group_derived_data(
            group=self.groups[1],
            progress="diagnosed",
            last_progressed_at=base.replace(microsecond=200),
        )
        # groups[2] has no derived row -> identified (lowest rank), sorts last.
        tied = sorted([self.groups[0], self.groups[1]], key=lambda g: g.id, reverse=True)
        expected = tied + [self.groups[2]]

        seen = []
        cursor = None
        for _ in self.groups:
            page = self.make_query(sort_by="progress", query="issue", limit=1, cursor=cursor)
            seen.extend(page)
            cursor = page.next
        assert seen == expected

    @override_options(
        {
            "snuba.search.max-pre-snuba-candidates": 0,
            # Force the chunk time budget to expire before the first chunk runs, so no passers
            # are collected while the Postgres walk is not exhausted.
            "snuba.search.max-total-chunk-time-seconds": 0,
        }
    )
    def test_budget_exhausted_empty_page_terminates(self):
        # When the time budget expires before any Snuba match is found, the page must be a
        # terminating empty result. The cursor value is a progress score and can't encode a
        # mid-tie "resume at raw row N" checkpoint, so advertising next.has_results with a
        # non-advancing 0:0:0 cursor would make the client rescan the same prefix forever.
        # Following the next cursor must therefore not loop -- it terminates (has_results False).
        self.create_group_derived_data(group=self.groups[0], progress="fix_applied")
        page = self.make_query(sort_by="progress", query="issue", limit=2)
        assert list(page) == []
        assert not page.next.has_results
        # Following it (defensively) returns empty again and still terminates -- no infinite walk.
        page2 = self.make_query(sort_by="progress", query="issue", limit=2, cursor=page.next)
        assert list(page2) == []
        assert not page2.next.has_results

    @override_options(
        {
            "snuba.search.max-pre-snuba-candidates": 0,
            # One row per chunk so the early-break boundary-drain runs mid-tie on every page,
            # rather than the whole tied block arriving in a single chunk (which would exhaust
            # the walk before the drain logic is ever exercised).
            "snuba.search.max-chunk-size": 1,
        }
    )
    def test_score_tie_spanning_pages_forward_and_back_with_tiny_chunks(self):
        # Regression guard for the inverted path's cursor across a score tie that spans several
        # pages while the chunk loop breaks early (max-chunk-size=1). Five groups share an
        # identical score (same rank + same last_progressed_at), so ordering falls entirely to
        # the -id tiebreak. Forward paging (limit=2) must yield the exact id-DESC order with no
        # drops/dupes, and paging backward from the last page must retrace the preceding page
        # measured against the true global ordering (not just self-consistency) -- i.e. prev
        # returns the page adjacent to the cursor, not a window pulled from the wrong end.
        ts = before_now(days=2).replace(microsecond=0)
        extra = []
        for i in range(3, 5):
            event = self.store_event(
                data={
                    "fingerprint": [f"group-{i}"],
                    "event_id": f"{chr(97 + i)}" * 32,
                    "message": f"issue {i}",
                    "timestamp": (self.base_datetime - timedelta(days=i)).isoformat(),
                    "stacktrace": {"frames": [{"module": f"mod{i}"}]},
                    "environment": "production",
                },
                project_id=self.project.id,
            )
            g = Group.objects.get(id=event.group.id)
            g.status = GroupStatus.UNRESOLVED
            g.substatus = GroupSubStatus.ONGOING
            g.priority = PriorityLevel.HIGH
            g.update(type=ErrorGroupType.type_id)
            g.save()
            self.store_group(g)
            extra.append(g)
        all_groups = self.groups + extra
        for g in all_groups:
            self.create_group_derived_data(group=g, progress="diagnosed", last_progressed_at=ts)

        expected = sorted(all_groups, key=lambda g: g.id, reverse=True)

        # Page fully forward one page (limit=2) at a time; the concatenation must be the exact
        # id-DESC order with no drops or duplicates.
        forward: list[Group] = []
        pages: list[Any] = []
        cursor = None
        while True:
            page = self.make_query(sort_by="progress", query="issue", limit=2, cursor=cursor)
            results = list(page)
            pages.append(page)
            forward.extend(results)
            if not page.next.has_results:
                break
            cursor = page.next
        assert forward == expected
        assert len(pages) >= 3  # the tie genuinely spanned multiple pages

        # Paging backward from the last page must retrace the immediately preceding page.
        last_page_size = len(list(pages[-1]))
        expected_prev = expected[-last_page_size - 2 : -last_page_size]
        back = list(
            self.make_query(sort_by="progress", query="issue", limit=2, cursor=pages[-1].prev)
        )
        assert back == expected_prev


class TestDefaultPostgresSortStrategies(TestCase):
    def test_recommended_v2_registered(self):
        strategies = PostgresSnubaQueryExecutor().postgres_sort_strategies
        assert set(strategies) == {"recommended_v2", "progress"}
        strategy = strategies["recommended_v2"]
        assert strategy.snuba_aggregations == ["recommended"]
        assert strategy.exclude_null_postgres is False
        assert set(strategy.signal_resolvers) == {"assignment", "suspect_commit", "agent"}

    def test_recommended_v2_zero_weight_drops_signal_resolver(self):
        # A zeroed weight can't affect the score, so the strategy must not pay for that
        # signal's query.
        with self.options({"snuba.search.recommended.agent-weight": 0.0}):
            strategy = PostgresSnubaQueryExecutor().postgres_sort_strategies["recommended_v2"]
        assert set(strategy.signal_resolvers) == {"assignment", "suspect_commit"}

    def test_progress_registered(self):
        strategies = PostgresSnubaQueryExecutor().postgres_sort_strategies
        strategy = strategies["progress"]
        assert strategy.snuba_aggregations == ["last_seen"]
        assert set(strategy.signal_resolvers) == {"progress_rank", "last_progressed_at"}
        # progress maps to last_seen in sort_strategies so the chunked Snuba path has a
        # real aggregation to fall back to on candidate overflow.
        assert PostgresSnubaQueryExecutor.sort_strategies["progress"] == "last_seen"
