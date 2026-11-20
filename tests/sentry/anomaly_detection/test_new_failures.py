from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest import mock

from snuba_sdk import Column, Condition, Direction, Function, Op, OrderBy, Query

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    Service,
    Signal,
)
from sentry.anomaly_detection.inputs import new_failures
from sentry.anomaly_detection.inputs.measurements import ERROR_USER
from sentry.anomaly_detection.inputs.query import error_env
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import TestCase

START = datetime(2025, 10, 1)  # Collector timestamps are naive UTC.
MINUTE = timedelta(minutes=1)


def _where_all(query: Query, lhs: Column | Function) -> list[Condition]:
    return [
        condition
        for condition in query.where or ()
        if isinstance(condition, Condition) and condition.lhs == lhs
    ]


def _where(query: Query, lhs: Column | Function) -> Condition:
    (condition,) = _where_all(query, lhs)
    return condition


def _candidate(group: Group, users: int, *, env: str = "prod", prior: int = 0) -> dict[str, Any]:
    return {
        "env": env,
        "group_id": group.id,
        "users": users,
        "count()": users,
        "prior_users": prior,
    }


# The environment discovery reply that precedes each project's candidate query.
PROD = [{"env": "prod"}]


class TestNewFailures(TestCase):
    def _group(
        self, first_seen: datetime, message: str = "Checkout failed", **kwargs: Any
    ) -> Group:
        return self.create_group(
            project=self.project,
            first_seen=first_seen.replace(tzinfo=UTC),
            message=message,
            **kwargs,
        )

    def _collect(
        self,
        thresholds: new_failures.NewFailureThresholds | Mapping[Service, float],
        start: datetime,
        end: datetime,
    ) -> list[ChangeEvent]:
        return new_failures.collect_new_failure_modes(
            self.organization, [self.project], thresholds, start, end
        )

    def test_merges_title_and_crosses_on_distinct_users_by_receive_time(self) -> None:
        first_seen = (START - MINUTE).replace(tzinfo=UTC)
        first = self.create_group(
            project=self.project,
            first_seen=first_seen,
            data={"title": "issues:999", "type": "error"},
        )
        second = self.create_group(
            project=self.project,
            first_seen=first_seen,
            data={"title": "issues:999", "type": "error"},
        )
        other = self.create_group(
            project=self.project,
            first_seen=first_seen,
            type=ErrorGroupType.type_id + 1,
            create_open_period=False,
        )
        project = self.project.id
        end = START + 2 * MINUTE
        with mock.patch.object(
            new_failures,
            "run_errors",
            side_effect=[
                PROD,
                [
                    {**_candidate(first, 1), "count()": 2},
                    _candidate(second, 1),
                ],
                [{"first_seen": START - MINUTE}, {"first_seen": START + MINUTE}],
            ],
        ) as query:
            (change,) = self._collect({Service(project, "prod"): 2.0}, START, end)
        assert change.key == SeriesKey(
            project, "prod", Signal.NEW_ISSUE, Metric.COUNT_UNIQUE_USER, str(first.id)
        )
        assert change.change_type == ChangeType.NEW_FAILURE_MODE
        assert change.detected_at == end
        assert change.evidence == ["issues:999"]
        assert change.issue_ids == (first.id, second.id)
        (_, environments, _), (_, candidates, _), (_, users, referrer) = (
            call.args for call in query.call_args_list
        )
        assert referrer == Referrer.ANOMALY_DETECTION_ENRICH.value
        for snql in (environments, candidates, users):
            group_filter = _where(snql, Column("group_id"))
            assert set(group_filter.rhs) == {first.id, second.id}
            assert other.id not in group_filter.rhs
        # Users are ordered and bounded by when Sentry received their events.
        assert _where(users, Column("received")) == Condition(
            Column("received"), Op.LT, end.replace(tzinfo=UTC)
        )
        assert Function("min", [Column("received")], "first_seen") in users.select

    def test_reports_weak_then_strong(self) -> None:
        group = self._group(START)
        project = self.project.id
        with (
            mock.patch.object(new_failures, "_ISSUE_USER_PAGE_SIZE", 10),
            mock.patch.object(
                new_failures,
                "run_errors",
                side_effect=[
                    PROD,
                    [{**_candidate(group, 12), "count()": 13}],
                    [{"first_seen": START}] * 10,
                    [{"first_seen": START + MINUTE}] * 2,
                ],
            ) as query,
        ):
            weak, strong = self._collect(
                {Service(project, "prod"): 11.5}, START, START + 2 * MINUTE
            )
        (_, first_page, _), (_, second_page, _) = [call.args for call in query.call_args_list[2:]]
        assert first_page.limit.limit == 10
        assert first_page.offset is None
        assert second_page.limit.limit == 2
        assert second_page.offset.offset == 10
        assert first_page.groupby == [Column(ERROR_USER)]
        assert any(
            condition.lhs == Column(ERROR_USER) and condition.op == Op.NEQ and condition.rhs == ""
            for condition in first_page.where
        )
        assert weak.key == strong.key
        assert (weak.detected_at, weak.actual, weak.confidence) == (START + MINUTE, 10.0, 0.5)
        assert (strong.detected_at, strong.actual, strong.confidence) == (
            START + 2 * MINUTE,
            12.0,
            0.9,
        )

    def test_new_environment_uses_minimum_threshold(self) -> None:
        group = self._group(START)
        project = self.project.id
        with mock.patch.object(
            new_failures,
            "run_errors",
            side_effect=[
                [{"env": "new"}],
                [_candidate(group, 10, env="new")],
                [{"first_seen": START}] * 10,
            ],
        ) as query:
            (change,) = self._collect({Service(project, "historical"): 40.0}, START, START + MINUTE)
        assert (change.key.env, change.expected, change.confidence) == ("new", 10, 0.9)
        assert query.call_count == 3
        (_, candidates, _) = query.call_args_list[1].args
        assert _where(candidates, error_env()).rhs == ["new"]

    def test_discovers_busiest_environments_by_receive_time(self) -> None:
        # Seen before the interval, so its late events carry old timestamps.
        group = self._group(START - 30 * MINUTE)
        with (
            mock.patch.object(new_failures, "MAX_ENVIRONMENTS", 1),
            mock.patch.object(
                new_failures, "run_errors", side_effect=[[{"env": "production"}], []]
            ) as query,
        ):
            assert self._collect({}, START, START + MINUTE) == []
        (_, environments, _), (_, candidates, _) = (call.args for call in query.call_args_list)
        assert environments.limit.limit == 1
        assert environments.orderby[0] == OrderBy(Function("count", []), Direction.DESC)
        assert environments.groupby == [error_env("env")]
        assert _where(environments, Column("group_id")).rhs == [group.id]
        # Received in the interval, with timestamps reaching back to the issue onset.
        assert _where_all(environments, Column("received")) == [
            Condition(Column("received"), Op.LT, (START + MINUTE).replace(tzinfo=UTC)),
            Condition(Column("received"), Op.GTE, START.replace(tzinfo=UTC)),
        ]
        assert _where_all(environments, Column("timestamp"))[0].rhs == (
            START - 30 * MINUTE
        ).replace(tzinfo=UTC)
        assert _where(candidates, error_env()).rhs == ["production"]

    def test_skips_projects_without_recent_groups(self) -> None:
        with mock.patch.object(new_failures, "run_errors") as query:
            assert self._collect({}, START, START + MINUTE) == []
        query.assert_not_called()

    def test_boundary_environments_supplement_received_environments(self) -> None:
        self._group(START + 30 * MINUTE)
        project = self.project.id
        # The threshold falls at START + 1h, which makes "quiet" a boundary scope.
        thresholds = new_failures.NewFailureThresholds(
            {
                Service(project, "quiet"): [
                    (START - new_failures._THRESHOLD_LOOKBACK, 1000.0),
                    (START, 200.0),
                ]
            }
        )
        with mock.patch.object(new_failures, "run_errors", side_effect=[PROD, []]) as query:
            self._collect(thresholds, START + 59 * MINUTE, START + 61 * MINUTE)
        (_, candidates, _) = query.call_args_list[1].args
        assert _where(candidates, error_env()).rhs == ["prod", "quiet"]

    def test_candidate_groups_prefer_volume_over_recency(self) -> None:
        incident = self._group(START - 20 * MINUTE, times_seen=500)
        noise = [self._group(START - i * MINUTE, f"noise {i}", times_seen=1) for i in (1, 2)]
        with (
            mock.patch.object(new_failures, "_MAX_NEW_GROUPS", 2),
            mock.patch("sentry.anomaly_detection.inputs.new_failures.metrics") as metrics,
        ):
            groups = new_failures._recent_error_groups(self.project, START, START + MINUTE)
        assert [group.id for group in groups] == [incident.id, noise[0].id]
        metrics.incr.assert_called_once_with("anomaly_detection.new_failures.group_limit")

    def test_title_onset_does_not_depend_on_which_members_have_errors(self) -> None:
        lead = self._group(START - 30 * MINUTE)
        member = self._group(START - 20 * MINUTE)
        project = self.project.id
        early_users = [{"first_seen": START - 5 * MINUTE}] * 9
        with mock.patch.object(
            new_failures,
            "run_errors",
            side_effect=[
                PROD,
                # The lead has no errors in this environment yet.
                [_candidate(member, 10)],
                [*early_users, {"first_seen": START + timedelta(seconds=10)}],
                PROD,
                [_candidate(lead, 1), _candidate(member, 10, prior=10)],
                [
                    *early_users,
                    {"first_seen": START + timedelta(seconds=10)},
                    {"first_seen": START + timedelta(minutes=1, seconds=10)},
                ],
            ],
        ) as query:
            thresholds = {Service(project, "prod"): 11.0}
            (weak,) = self._collect(thresholds, START, START + MINUTE)
            (strong,) = self._collect(thresholds, START + MINUTE, START + 2 * MINUTE)
        # Both milestones belong to one episode keyed by the title's first group.
        assert weak.key == strong.key
        assert weak.key.dim_value == str(lead.id)
        assert weak.start == strong.start == START - 30 * MINUTE
        assert (weak.detected_at, weak.actual, weak.issue_ids) == (START + MINUTE, 10, (member.id,))
        assert (strong.detected_at, strong.actual, strong.issue_ids) == (
            START + 2 * MINUTE,
            11,
            (lead.id, member.id),
        )
        (_, candidates, _) = query.call_args_list[1].args
        assert set(_where(candidates, Column("group_id")).rhs) == {lead.id, member.id}

    def test_title_lifetimes_ignore_members_of_ended_and_recurring_titles(self) -> None:
        # Ended lifetime: its late member is not a new onset.
        self._group(START - 70 * MINUTE, "ended")
        self._group(START - 30 * MINUTE, "ended")
        # Recurring title: every group follows another within a lifetime.
        self._group(START - 100 * MINUTE, "recurring")
        self._group(START - 45 * MINUTE, "recurring")
        self._group(START - 10 * MINUTE, "recurring")
        # Returning title: its previous group is more than a lifetime earlier.
        self._group(START - 110 * MINUTE, "returning")
        returning = self._group(START - 5 * MINUTE, "returning")
        with mock.patch.object(new_failures, "run_errors", return_value=[]) as query:
            self._collect({}, START, START + MINUTE)
        # No environment received errors, so only discovery ran.
        (_, environments, _) = query.call_args.args
        assert _where(environments, Column("group_id")).rhs == [returning.id]

    def test_skips_titles_that_crossed_before_the_interval(self) -> None:
        group = self._group(START - 10 * MINUTE)
        project = self.project.id
        # The candidate row doubles as the environment discovery reply.
        with mock.patch.object(
            new_failures, "run_errors", return_value=[_candidate(group, 12, prior=10)]
        ) as query:
            assert self._collect({Service(project, "prod"): 10.0}, START, START + MINUTE) == []
        # Only discovery and the candidate query ran: replaying the title cannot report anything new.
        assert query.call_count == 2

    def test_query_budget_evaluates_highest_impact_titles_first(self) -> None:
        small = self._group(START - 10 * MINUTE, "small")
        large = self._group(START - 10 * MINUTE, "large")
        project = self.project.id
        with (
            mock.patch.object(new_failures, "_MAX_ISSUE_QUERIES", 1),
            mock.patch.object(
                new_failures,
                "run_errors",
                side_effect=[
                    PROD,
                    [_candidate(small, 20), _candidate(large, 50)],
                    [{"first_seen": START}] * 10,
                ],
            ) as query,
            mock.patch("sentry.anomaly_detection.inputs.new_failures.metrics") as metrics,
        ):
            (change,) = self._collect({Service(project, "prod"): 10.0}, START, START + MINUTE)
        assert change.key.dim_value == str(large.id)
        (_, users, _) = query.call_args.args
        assert _where(users, Column("group_id")).rhs == [large.id]
        metrics.incr.assert_called_once_with(
            "anomaly_detection.new_failures.query_budget_exhausted", amount=1
        )
