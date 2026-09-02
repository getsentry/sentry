from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.billing.v1.date_pb2 import Date
from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_by_project_pb2 import (
    GetUsageByProjectRequest,
    GetUsageByProjectResponse,
)
from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_pb2 import (
    GetUsageRequest,
    GetUsageResponse,
)
from snuba_sdk import Column, Function, Op

from sentry.billing.platform.services.category_mapping import sentry_to_proto_category
from sentry.billing.platform.services.usage._outcomes_query import (
    _BILLABLE_OUTCOMES,
    _build_query,
    _build_response,
    _over_quota_condition,
    _total_function,
    query_outcomes_usage,
)
from sentry.billing.platform.services.usage._project_outcomes_query import (
    ProjectUsageQueryTruncatedError,
    _build_project_query,
    _build_project_response,
    query_project_outcomes_usage,
)
from sentry.utils.outcomes import Outcome


def _make_timestamp(dt: datetime) -> Timestamp:
    ts = Timestamp()
    ts.FromDatetime(dt)
    return ts


def _make_row(
    *,
    time: str = "2025-03-15T00:00:00+00:00",
    category: int = 1,
    total: int = 0,
    accepted: int = 0,
    dropped: int = 0,
    filtered: int = 0,
    over_quota: int = 0,
    spike_protection: int = 0,
    dynamic_sampling: int = 0,
) -> dict:
    return {
        "time": time,
        "category": category,
        "total": total,
        "accepted": accepted,
        "dropped": dropped,
        "filtered": filtered,
        "over_quota": over_quota,
        "spike_protection": spike_protection,
        "dynamic_sampling": dynamic_sampling,
    }


class TestOverQuotaCondition:
    def test_returns_and_function(self):
        cond = _over_quota_condition()
        assert isinstance(cond, Function)
        assert cond.function == "and"

    def test_outer_condition_checks_rate_limited(self):
        cond = _over_quota_condition()
        outcome_check = cond.parameters[0]
        assert outcome_check.function == "equals"
        assert isinstance(outcome_check.parameters[0], Column)
        assert outcome_check.parameters[0].name == "outcome"
        assert outcome_check.parameters[1] == Outcome.RATE_LIMITED

    def test_inner_or_includes_ends_with(self):
        cond = _over_quota_condition()
        or_clause = cond.parameters[1]
        assert or_clause.function == "or"
        ends_with = or_clause.parameters[0]
        assert ends_with.function == "endsWith"
        assert ends_with.parameters[1] == "_usage_exceeded"

    def test_inner_or_includes_usage_exceeded_and_grace_period(self):
        cond = _over_quota_condition()
        inner_or = cond.parameters[1].parameters[1]
        assert inner_or.function == "or"
        equals_fns = [inner_or.parameters[0], inner_or.parameters[1]]
        values = {fn.parameters[1] for fn in equals_fns}
        assert values == {"usage_exceeded", "grace_period"}


class TestBuildResponse:
    def test_build_response_empty(self):
        response = _build_response([], None)

        assert isinstance(response, GetUsageResponse)
        assert list(response.days) == []

    def test_build_response_multi_day(self):
        rows = [
            _make_row(time="2025-03-17T00:00:00+00:00", accepted=50, total=50),
            _make_row(time="2025-03-15T00:00:00+00:00", accepted=100, total=100),
            _make_row(time="2025-03-16T00:00:00+00:00", accepted=75, total=75),
        ]
        response = _build_response(rows, None)

        assert len(response.days) == 3
        assert response.days[0].date == Date(year=2025, month=3, day=15)
        assert response.days[1].date == Date(year=2025, month=3, day=16)
        assert response.days[2].date == Date(year=2025, month=3, day=17)

    def test_build_response_multi_category(self):
        rows = [
            _make_row(time="2025-03-15T00:00:00+00:00", category=2, accepted=50, total=50),
            _make_row(time="2025-03-15T00:00:00+00:00", category=1, accepted=100, total=100),
            _make_row(time="2025-03-15T00:00:00+00:00", category=9, accepted=25, total=25),
        ]
        response = _build_response(rows, None)

        assert len(response.days) == 1
        day = response.days[0]
        assert len(day.usage) == 3

        usage_by_cat = {u.category: u.data.accepted for u in day.usage}
        assert usage_by_cat[sentry_to_proto_category(1)] == 100
        assert usage_by_cat[sentry_to_proto_category(2)] == 50
        assert usage_by_cat[sentry_to_proto_category(9)] == 25

    def test_build_response_skips_unmapped_sentry_category(self):
        # Sentry SESSION=5 has no proto mapping; passing the int through would
        # collide with proto REPLAY=5 and clobber real replay data via the
        # response builder's overwrite.
        rows = [
            _make_row(time="2025-03-15T00:00:00+00:00", category=7, accepted=42, total=42),
            _make_row(time="2025-03-15T00:00:00+00:00", category=5, accepted=999, total=999),
        ]
        response = _build_response(rows, None)

        assert len(response.days) == 1
        day = response.days[0]
        assert len(day.usage) == 1
        assert day.usage[0].category == sentry_to_proto_category(7)
        assert day.usage[0].data.accepted == 42

    def test_build_response_preserves_overlapping_semantics(self):
        """dropped >= over_quota + spike_protection — all values preserved as-is from query."""
        rows = [
            _make_row(
                total=175,
                accepted=0,
                dropped=175,
                filtered=0,
                over_quota=100,
                spike_protection=50,
                dynamic_sampling=0,
            )
        ]
        response = _build_response(rows, None)

        data = response.days[0].usage[0].data
        assert data.dropped == 175
        assert data.over_quota == 100
        assert data.spike_protection == 50
        assert data.dropped >= data.over_quota + data.spike_protection

    def test_build_response_all_fields(self):
        rows = [
            _make_row(
                time="2025-03-15T00:00:00+00:00",
                category=1,
                total=100,
                accepted=60,
                dropped=40,
                filtered=0,
                over_quota=30,
                spike_protection=10,
                dynamic_sampling=0,
            ),
        ]
        response = _build_response(rows, None)

        assert len(response.days) == 1
        data = response.days[0].usage[0].data
        assert data.total == 100
        assert data.accepted == 60
        assert data.dropped == 40
        assert data.over_quota == 30
        assert data.spike_protection == 10
        assert data.filtered == 0
        assert data.dynamic_sampling == 0


class TestBuildQuery:
    def test_build_query_with_categories(self):
        start = datetime(2025, 3, 1, tzinfo=timezone.utc)
        end = datetime(2025, 3, 31, tzinfo=timezone.utc)

        snuba_request = _build_query(org_id=1, start=start, end=end, categories=[1, 2])

        query = snuba_request.query
        category_conditions = [
            c for c in query.where if hasattr(c, "lhs") and c.lhs.name == "category"
        ]
        assert len(category_conditions) == 1
        assert category_conditions[0].op == Op.IN
        assert category_conditions[0].rhs == [1, 2]

    def test_build_query_no_categories(self):
        start = datetime(2025, 3, 1, tzinfo=timezone.utc)
        end = datetime(2025, 3, 31, tzinfo=timezone.utc)

        snuba_request = _build_query(org_id=1, start=start, end=end, categories=[])

        query = snuba_request.query
        category_conditions = [
            c for c in query.where if hasattr(c, "lhs") and c.lhs.name == "category"
        ]
        assert len(category_conditions) == 0

    def test_build_query_basic_structure(self):
        start = datetime(2025, 3, 1, tzinfo=timezone.utc)
        end = datetime(2025, 3, 31, tzinfo=timezone.utc)

        snuba_request = _build_query(org_id=42, start=start, end=end, categories=[])

        assert snuba_request.dataset == "outcomes"
        assert snuba_request.app_id == "billing"
        assert snuba_request.tenant_ids == {"organization_id": 42}

        query = snuba_request.query
        org_conditions = [c for c in query.where if hasattr(c, "lhs") and c.lhs.name == "org_id"]
        assert len(org_conditions) == 1
        assert org_conditions[0].rhs == 42

    def test_build_query_groups_by_category_and_time_only(self):
        start = datetime(2025, 3, 1, tzinfo=timezone.utc)
        end = datetime(2025, 3, 31, tzinfo=timezone.utc)

        snuba_request = _build_query(org_id=1, start=start, end=end, categories=[])

        groupby_names = [col.name for col in snuba_request.query.groupby]
        assert groupby_names == ["category", "time"]

    def test_build_query_total_filters_billable_outcomes(self):
        start = datetime(2025, 3, 1, tzinfo=timezone.utc)
        end = datetime(2025, 3, 31, tzinfo=timezone.utc)

        snuba_request = _build_query(
            org_id=1, start=start, end=end, categories=[], total_outcomes=_BILLABLE_OUTCOMES
        )

        select = snuba_request.query.select
        total_fn = next(f for f in select if isinstance(f, Function) and f.alias == "total")
        # total must use sumIf, not bare sum — only billable outcomes
        assert total_fn.function == "sumIf"
        # The condition should filter to ACCEPTED, FILTERED, RATE_LIMITED via in(outcome, tuple(...))
        condition = total_fn.parameters[1]
        assert condition.function == "in"
        outcome_col = condition.parameters[0]
        assert isinstance(outcome_col, Column)
        assert outcome_col.name == "outcome"
        tuple_fn = condition.parameters[1]
        assert tuple_fn.function == "tuple"
        assert set(tuple_fn.parameters) == {
            Outcome.ACCEPTED,
            Outcome.FILTERED,
            Outcome.RATE_LIMITED,
        }

    def test_build_query_total_all_outcomes_when_none(self):
        start = datetime(2025, 3, 1, tzinfo=timezone.utc)
        end = datetime(2025, 3, 31, tzinfo=timezone.utc)

        snuba_request = _build_query(
            org_id=1, start=start, end=end, categories=[], total_outcomes=None
        )

        select = snuba_request.query.select
        total_fn = next(f for f in select if isinstance(f, Function) and f.alias == "total")
        # No outcome filter — bare sum(quantity) for all outcomes
        assert total_fn.function == "sum"

    def test_total_function_with_outcomes(self):
        fn = _total_function(_BILLABLE_OUTCOMES)
        assert fn.function == "sumIf"
        assert fn.alias == "total"

    def test_total_function_without_outcomes(self):
        fn = _total_function(None)
        assert fn.function == "sum"
        assert fn.alias == "total"

    def test_build_query_select_has_sumif_columns(self):
        start = datetime(2025, 3, 1, tzinfo=timezone.utc)
        end = datetime(2025, 3, 31, tzinfo=timezone.utc)

        snuba_request = _build_query(org_id=1, start=start, end=end, categories=[])

        select = snuba_request.query.select
        aliases = []
        for item in select:
            if isinstance(item, Column):
                aliases.append(item.name)
            elif isinstance(item, Function):
                aliases.append(item.alias)
        assert aliases == [
            "category",
            "time",
            "max_ts",
            "total",
            "accepted",
            "dropped",
            "filtered",
            "over_quota",
            "spike_protection",
            "dynamic_sampling",
        ]


class TestQueryOutcomesUsage:
    @patch("sentry.billing.platform.services.usage._outcomes_query.raw_snql_query")
    def test_query_uses_billing_referrer(self, mock_query):
        mock_query.return_value = {"data": []}

        start = _make_timestamp(datetime(2025, 3, 1, tzinfo=timezone.utc))
        end = _make_timestamp(datetime(2025, 3, 31, tzinfo=timezone.utc))
        request = GetUsageRequest(organization_id=1, start=start, end=end)

        query_outcomes_usage(request)

        mock_query.assert_called_once()
        _, kwargs = mock_query.call_args
        assert kwargs["referrer"] == "billing.usage_service.clickhouse"

    @patch("sentry.billing.platform.services.usage._outcomes_query.raw_snql_query")
    def test_end_date_shifted_plus_one_day(self, mock_query):
        """Proto end is inclusive (last included day). The query shifts +1 day for half-open."""
        mock_query.return_value = {"data": []}

        start = _make_timestamp(datetime(2025, 3, 1, tzinfo=timezone.utc))
        end = _make_timestamp(datetime(2025, 3, 31, tzinfo=timezone.utc))
        request = GetUsageRequest(organization_id=1, start=start, end=end)

        query_outcomes_usage(request)

        snuba_request = mock_query.call_args[0][0]
        timestamp_conditions = {
            c.op: c.rhs
            for c in snuba_request.query.where
            if hasattr(c, "lhs") and c.lhs.name == "timestamp"
        }
        assert timestamp_conditions[Op.GTE] == datetime(2025, 3, 1, tzinfo=timezone.utc)
        # end=March 31 (inclusive) → query uses < April 1 (exclusive)
        assert timestamp_conditions[Op.LT] == datetime(
            2025, 3, 31, tzinfo=timezone.utc
        ) + timedelta(days=1)

    @patch("sentry.billing.platform.services.usage._outcomes_query.raw_snql_query")
    def test_query_returns_response(self, mock_query):
        mock_query.return_value = {
            "data": [
                {
                    "time": "2025-03-15T00:00:00+00:00",
                    "category": 1,
                    "max_ts": "2025-03-15T11:00:00+00:00",
                    "total": 200,
                    "accepted": 200,
                    "dropped": 0,
                    "filtered": 0,
                    "over_quota": 0,
                    "spike_protection": 0,
                    "dynamic_sampling": 0,
                }
            ]
        }

        start = _make_timestamp(datetime(2025, 3, 1, tzinfo=timezone.utc))
        end = _make_timestamp(datetime(2025, 3, 31, tzinfo=timezone.utc))
        request = GetUsageRequest(organization_id=1, start=start, end=end)

        response = query_outcomes_usage(request)

        assert isinstance(response, GetUsageResponse)
        assert len(response.days) == 1
        assert response.days[0].date == Date(year=2025, month=3, day=15)
        assert response.days[0].usage[0].data.accepted == 200


def _make_project_row(
    *,
    project_id: int = 10,
    time: str = "2025-03-15T00:00:00+00:00",
    category: int = 1,
    accepted: int = 100,
    max_ts: str = "2025-03-15T11:00:00+00:00",
) -> dict:
    return {
        "project_id": project_id,
        "time": time,
        "category": category,
        "max_ts": max_ts,
        "total": accepted,
        "accepted": accepted,
        "dropped": 0,
        "filtered": 0,
        "over_quota": 0,
        "spike_protection": 0,
        "dynamic_sampling": 0,
    }


class TestBuildProjectResponse:
    def test_groups_usage_by_project_day_and_category(self):
        response = _build_project_response(
            [
                _make_project_row(project_id=20, category=2, accepted=25),
                _make_project_row(project_id=10, category=1, accepted=100),
                _make_project_row(
                    project_id=10,
                    time="2025-03-16T00:00:00+00:00",
                    category=1,
                    accepted=50,
                ),
            ],
            None,
        )

        assert isinstance(response, GetUsageByProjectResponse)
        assert [project.project_id for project in response.projects] == [10, 20]
        assert list(response.projects[0].seat_days) == []
        assert [day.date for day in response.projects[0].days] == [
            Date(year=2025, month=3, day=15),
            Date(year=2025, month=3, day=16),
        ]
        assert response.projects[0].days[0].usage[0].data.accepted == 100

    def test_skips_unmapped_category(self):
        response = _build_project_response([_make_project_row(category=5)], None)

        assert list(response.projects) == []

    def test_sets_last_usage_timestamp(self):
        last_usage_ts = datetime(2025, 3, 15, 11, tzinfo=timezone.utc)

        response = _build_project_response([], last_usage_ts)

        assert response.last_usage_ts.ToDatetime(tzinfo=timezone.utc) == last_usage_ts


class TestBuildProjectQuery:
    def test_adds_project_id_to_shared_query(self):
        start = datetime(2025, 3, 15, 6, tzinfo=timezone.utc)
        end = datetime(2025, 3, 16, 6, tzinfo=timezone.utc)
        request = _build_project_query(42, start, end, [1, 2])
        organization_request = _build_query(
            42,
            start,
            end,
            [1, 2],
            total_outcomes=_BILLABLE_OUTCOMES,
        )

        assert request.dataset == organization_request.dataset
        assert request.app_id == organization_request.app_id
        assert request.tenant_ids == organization_request.tenant_ids
        assert request.query.match == organization_request.query.match
        assert request.query.where == organization_request.query.where
        assert request.query.select[1:] == organization_request.query.select
        assert request.query.groupby[1:] == organization_request.query.groupby
        assert request.query.orderby[1:] == organization_request.query.orderby
        assert request.query.granularity == organization_request.query.granularity
        assert request.query.limit == organization_request.query.limit

        assert request.query.select[0] == Column("project_id")
        assert request.query.groupby[0] == Column("project_id")
        assert request.query.orderby[0].exp == Column("project_id")


class TestQueryProjectOutcomesUsage:
    @patch("sentry.billing.platform.services.usage._project_outcomes_query.raw_snql_query")
    def test_end_date_shifted_plus_one_day(self, mock_query):
        mock_query.return_value = {"data": []}
        start_dt = datetime(2025, 3, 15, tzinfo=timezone.utc)
        end_dt = datetime(2025, 3, 15, tzinfo=timezone.utc)
        request = GetUsageByProjectRequest(
            organization_id=1,
            start=_make_timestamp(start_dt),
            end=_make_timestamp(end_dt),
        )

        query_project_outcomes_usage(request)

        snuba_request = mock_query.call_args.args[0]
        timestamp_conditions = {
            condition.op: condition.rhs
            for condition in snuba_request.query.where
            if hasattr(condition, "lhs") and condition.lhs.name == "timestamp"
        }
        assert timestamp_conditions[Op.GTE] == start_dt
        assert timestamp_conditions[Op.LT] == end_dt + timedelta(days=1)

    @patch("sentry.billing.platform.services.usage._project_outcomes_query.metrics")
    @patch("sentry.billing.platform.services.usage._project_outcomes_query.raw_snql_query")
    def test_raises_when_query_reaches_row_limit(self, mock_query, mock_metrics):
        mock_query.return_value = {"data": [{}] * 10000}
        request = GetUsageByProjectRequest(
            organization_id=1,
            start=_make_timestamp(datetime(2025, 3, 1, tzinfo=timezone.utc)),
            end=_make_timestamp(datetime(2025, 3, 2, tzinfo=timezone.utc)),
        )

        with pytest.raises(ProjectUsageQueryTruncatedError, match="10,000-row limit"):
            query_project_outcomes_usage(request)

        mock_metrics.incr.assert_called_once_with(
            "billing.project_usage_query.truncated", sample_rate=1.0
        )

    @patch("sentry.billing.platform.services.usage._project_outcomes_query.raw_snql_query")
    def test_request_queries_all_projects(self, mock_query):
        mock_query.return_value = {"data": []}
        request = GetUsageByProjectRequest(
            organization_id=1,
            start=_make_timestamp(datetime(2025, 3, 1, tzinfo=timezone.utc)),
            end=_make_timestamp(datetime(2025, 3, 2, tzinfo=timezone.utc)),
        )

        response = query_project_outcomes_usage(request)

        assert list(response.projects) == []
        mock_query.assert_called_once()

    @patch("sentry.billing.platform.services.usage._project_outcomes_query.raw_snql_query")
    def test_returns_latest_usage_timestamp(self, mock_query):
        mock_query.return_value = {
            "data": [
                _make_project_row(max_ts="2025-03-15T10:00:00+00:00"),
                _make_project_row(project_id=20, max_ts="2025-03-15T12:00:00+00:00"),
            ]
        }
        request = GetUsageByProjectRequest(
            organization_id=1,
            start=_make_timestamp(datetime(2025, 3, 15, tzinfo=timezone.utc)),
            end=_make_timestamp(datetime(2025, 3, 16, tzinfo=timezone.utc)),
        )

        response = query_project_outcomes_usage(request)

        assert response.last_usage_ts.ToDatetime(tzinfo=timezone.utc) == datetime(
            2025, 3, 15, 12, tzinfo=timezone.utc
        )
