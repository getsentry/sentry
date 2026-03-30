from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.billing.v1.date_pb2 import Date
from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_pb2 import (
    GetUsageRequest,
    GetUsageResponse,
)
from snuba_sdk import Op

from sentry.billing.platform.services.usage._outcomes_query import (
    _build_query,
    _build_response,
    _empty_fields,
    _is_over_quota_reason,
    _map_outcome_to_fields,
    query_outcomes_usage,
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
    outcome: int = 0,
    reason: str = "",
    qty: int = 100,
) -> dict:
    return {
        "time": time,
        "category": category,
        "outcome": outcome,
        "reason": reason,
        "qty": qty,
    }


class TestMapOutcomeToFields:
    def test_map_outcome_accepted(self):
        fields = _empty_fields()
        _map_outcome_to_fields(fields, Outcome.ACCEPTED, "", 100)

        assert fields["accepted"] == 100
        assert fields["total"] == 100
        assert fields["dropped"] == 0
        assert fields["filtered"] == 0

    def test_map_outcome_rate_limited_over_quota(self):
        fields = _empty_fields()
        _map_outcome_to_fields(fields, Outcome.RATE_LIMITED, "usage_exceeded", 50)

        assert fields["dropped"] == 50
        assert fields["over_quota"] == 50
        assert fields["total"] == 50
        assert fields["spike_protection"] == 0

    def test_map_outcome_rate_limited_spike(self):
        fields = _empty_fields()
        _map_outcome_to_fields(fields, Outcome.RATE_LIMITED, "smart_rate_limit", 30)

        assert fields["dropped"] == 30
        assert fields["spike_protection"] == 30
        assert fields["total"] == 30
        assert fields["over_quota"] == 0

    def test_map_outcome_rate_limited_other(self):
        fields = _empty_fields()
        _map_outcome_to_fields(fields, Outcome.RATE_LIMITED, "some_random_reason", 20)

        assert fields["dropped"] == 20
        assert fields["over_quota"] == 0
        assert fields["spike_protection"] == 0
        assert fields["total"] == 20

    def test_map_outcome_filtered_dynamic_sampling(self):
        fields = _empty_fields()
        _map_outcome_to_fields(fields, Outcome.FILTERED, "Sampled:100", 40)

        assert fields["filtered"] == 40
        assert fields["dynamic_sampling"] == 40
        assert fields["total"] == 40

    def test_map_outcome_filtered_other(self):
        fields = _empty_fields()
        _map_outcome_to_fields(fields, Outcome.FILTERED, "ip-filter", 15)

        assert fields["filtered"] == 15
        assert fields["dynamic_sampling"] == 0
        assert fields["total"] == 15

    def test_overlapping_semantics(self):
        """dropped >= over_quota + spike_protection when multiple reasons contribute."""
        fields = _empty_fields()
        _map_outcome_to_fields(fields, Outcome.RATE_LIMITED, "usage_exceeded", 100)
        _map_outcome_to_fields(fields, Outcome.RATE_LIMITED, "smart_rate_limit", 50)
        _map_outcome_to_fields(fields, Outcome.RATE_LIMITED, "other_reason", 25)

        assert fields["dropped"] == 175
        assert fields["over_quota"] == 100
        assert fields["spike_protection"] == 50
        assert fields["dropped"] >= fields["over_quota"] + fields["spike_protection"]


class TestIsOverQuotaReason:
    def test_standard_usage_exceeded(self):
        assert _is_over_quota_reason("usage_exceeded") is True
        assert _is_over_quota_reason("error_usage_exceeded") is True
        assert _is_over_quota_reason("span_usage_exceeded") is True

    def test_grace_period(self):
        assert _is_over_quota_reason("grace_period") is True

    def test_new_category_usage_exceeded(self):
        """Any new *_usage_exceeded reason is automatically matched."""
        assert _is_over_quota_reason("future_category_usage_exceeded") is True

    def test_non_quota_reasons(self):
        assert _is_over_quota_reason("smart_rate_limit") is False
        assert _is_over_quota_reason("some_random_reason") is False
        assert _is_over_quota_reason("") is False

    def test_partial_match_not_accepted(self):
        assert _is_over_quota_reason("usage_exceeded_extra") is False


class TestBuildResponse:
    def test_build_response_empty(self):
        response = _build_response([])

        assert isinstance(response, GetUsageResponse)
        assert list(response.days) == []

    def test_build_response_multi_day(self):
        rows = [
            _make_row(time="2025-03-17T00:00:00+00:00", outcome=Outcome.ACCEPTED, qty=50),
            _make_row(time="2025-03-15T00:00:00+00:00", outcome=Outcome.ACCEPTED, qty=100),
            _make_row(time="2025-03-16T00:00:00+00:00", outcome=Outcome.ACCEPTED, qty=75),
        ]
        response = _build_response(rows)

        assert len(response.days) == 3
        assert response.days[0].date == Date(year=2025, month=3, day=15)
        assert response.days[1].date == Date(year=2025, month=3, day=16)
        assert response.days[2].date == Date(year=2025, month=3, day=17)

    def test_build_response_multi_category(self):
        rows = [
            _make_row(
                time="2025-03-15T00:00:00+00:00", category=2, outcome=Outcome.ACCEPTED, qty=50
            ),
            _make_row(
                time="2025-03-15T00:00:00+00:00", category=1, outcome=Outcome.ACCEPTED, qty=100
            ),
            _make_row(
                time="2025-03-15T00:00:00+00:00", category=9, outcome=Outcome.ACCEPTED, qty=25
            ),
        ]
        response = _build_response(rows)

        assert len(response.days) == 1
        day = response.days[0]
        assert len(day.usage) == 3
        assert day.usage[0].category == 1
        assert day.usage[1].category == 2
        assert day.usage[2].category == 9

        assert day.usage[0].data.accepted == 100
        assert day.usage[1].data.accepted == 50
        assert day.usage[2].data.accepted == 25

    def test_build_response_aggregates_same_category_day(self):
        rows = [
            _make_row(
                time="2025-03-15T00:00:00+00:00", category=1, outcome=Outcome.ACCEPTED, qty=60
            ),
            _make_row(
                time="2025-03-15T00:00:00+00:00",
                category=1,
                outcome=Outcome.RATE_LIMITED,
                reason="usage_exceeded",
                qty=40,
            ),
        ]
        response = _build_response(rows)

        assert len(response.days) == 1
        day = response.days[0]
        assert len(day.usage) == 1

        data = day.usage[0].data
        assert data.total == 100
        assert data.accepted == 60
        assert data.dropped == 40
        assert data.over_quota == 40


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
                    "outcome": Outcome.ACCEPTED,
                    "reason": "",
                    "qty": 200,
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
