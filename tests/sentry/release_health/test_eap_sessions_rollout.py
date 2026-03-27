from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import (
    DataPoint,
    TimeSeries,
    TimeSeriesResponse,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    Function,
)

from sentry.release_health.eap_sessions_rollout import (
    _FRESHNESS_BUFFER,
    _build_eap_timeseries_request,
    _FieldSpec,
    _transform_eap_response,
    compare_get_series_results,
    get_series_eap,
    is_session_metrics_query,
)
from sentry.snuba.sessions_v2 import isoformat_z
from sentry.testutils.cases import TestCase

NOW = datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
ONE_HOUR_AGO = NOW - timedelta(hours=1)

# Commonly used field specs
_SESSION_COUNT = _FieldSpec("session_count")
_USER_COUNT = _FieldSpec("user_count")
_CRASH_FREE_SESSION = _FieldSpec("session_rate", "crashed", True)


def _make_timestamp(dt: datetime) -> Timestamp:
    ts = Timestamp()
    ts.FromDatetime(dt)
    return ts


def _make_timeseries(
    label: str,
    values: list[float],
    group_by: dict[str, str] | None = None,
    start: datetime | None = None,
    rollup: int = 3600,
) -> TimeSeries:
    base_time = start or ONE_HOUR_AGO
    buckets = [
        _make_timestamp(base_time + timedelta(seconds=rollup * i)) for i in range(len(values))
    ]
    data_points = [DataPoint(data=v, data_present=True) for v in values]
    return TimeSeries(
        label=label,
        group_by_attributes=group_by or {},
        buckets=buckets,
        data_points=data_points,
    )


def _default_request_kwargs(**overrides: object) -> dict[str, Any]:
    """Build default kwargs for _build_eap_timeseries_request."""
    defaults = {
        "org_id": 1,
        "project_ids": [1],
        "fields": [_SESSION_COUNT],
        "raw_groupby": [],
        "start": ONE_HOUR_AGO,
        "end": NOW,
        "rollup": 3600,
        "where": [],
    }
    defaults.update(overrides)
    return defaults


class TestBuildEapRequest(TestCase):
    def test_session_count(self) -> None:
        request = _build_eap_timeseries_request(**_default_request_kwargs())

        labels = [expr.label for expr in request.expressions]
        assert "sum_session_init" in labels
        assert "sum_session_crashed" in labels
        assert "errored_set_count" in labels

        for expr in request.expressions:
            if expr.label == "sum_session_init":
                agg = expr.conditional_aggregation
                assert agg.aggregate == Function.FUNCTION_SUM
                assert agg.key.name == "session_count"
                assert agg.key.type == AttributeKey.Type.TYPE_INT

    def test_user_count(self) -> None:
        request = _build_eap_timeseries_request(**_default_request_kwargs(fields=[_USER_COUNT]))

        labels = [expr.label for expr in request.expressions]
        assert "uniq_user_all" in labels
        assert "uniq_user_init" not in labels

        for expr in request.expressions:
            if expr.label == "uniq_user_all":
                agg = expr.aggregation
                assert agg.aggregate == Function.FUNCTION_UNIQ
                assert agg.key.name == "user_id_hash"
                assert agg.key.type == AttributeKey.Type.TYPE_ARRAY

    def test_crash_free_rate(self) -> None:
        request = _build_eap_timeseries_request(
            **_default_request_kwargs(fields=[_CRASH_FREE_SESSION])
        )

        labels = [expr.label for expr in request.expressions]
        assert "sum_session_init" in labels
        assert "sum_session_crashed" in labels

    def test_with_groupby(self) -> None:
        request = _build_eap_timeseries_request(
            **_default_request_kwargs(raw_groupby=["project", "release", "environment"])
        )

        group_by_names = [gb.name for gb in request.group_by]
        assert "sentry.project_id" in group_by_names
        assert "release" in group_by_names
        assert "environment" in group_by_names

    def test_with_status_groupby(self) -> None:
        request = _build_eap_timeseries_request(
            **_default_request_kwargs(raw_groupby=["session.status"])
        )

        labels = [expr.label for expr in request.expressions]
        for status in ["init", "crashed", "errored_preaggr", "abnormal", "unhandled"]:
            assert f"sum_session_{status}" in labels
        assert "errored_set_count" in labels

        group_by_names = [gb.name for gb in request.group_by]
        assert "session.status" not in group_by_names
        assert "status" not in group_by_names


def _default_transform_kwargs(**overrides: object) -> dict[str, Any]:
    """Build default kwargs for _transform_eap_response."""
    defaults = {
        "fields": [_SESSION_COUNT],
        "field_alias_map": {_SESSION_COUNT: "sum(session)"},
        "raw_groupby": [],
        "start": ONE_HOUR_AGO,
        "end": NOW,
        "rollup": 3600,
        "include_totals": True,
        "include_series": True,
    }
    defaults.update(overrides)
    return defaults


class TestTransformResponse(TestCase):
    def test_basic_sum_session(self) -> None:
        response = TimeSeriesResponse(
            result_timeseries=[
                _make_timeseries("sum_session_init", [100.0]),
            ]
        )

        result = _transform_eap_response(response, **_default_transform_kwargs())
        assert len(result["groups"]) == 1
        group = result["groups"][0]
        assert group["series"]["sum(session)"] == [100.0]
        assert group["totals"]["sum(session)"] == 100.0

    def test_crash_free_rate(self) -> None:
        response = TimeSeriesResponse(
            result_timeseries=[
                _make_timeseries("sum_session_init", [100.0]),
                _make_timeseries("sum_session_crashed", [5.0]),
                _make_timeseries("sum_session_errored_preaggr", [0.0]),
                _make_timeseries("errored_set_count", [0.0]),
                _make_timeseries("sum_session_abnormal", [0.0]),
                _make_timeseries("sum_session_unhandled", [0.0]),
            ]
        )

        result = _transform_eap_response(
            response,
            **_default_transform_kwargs(
                fields=[_CRASH_FREE_SESSION],
                field_alias_map={_CRASH_FREE_SESSION: "crash_free_rate(session)"},
            ),
        )
        group = result["groups"][0]
        assert group["totals"]["crash_free_rate(session)"] == pytest.approx(0.95)
        assert group["series"]["crash_free_rate(session)"] == [pytest.approx(0.95)]

    def test_healthy_computation(self) -> None:
        response = TimeSeriesResponse(
            result_timeseries=[
                _make_timeseries("sum_session_init", [100.0]),
                _make_timeseries("sum_session_crashed", [3.0]),
                _make_timeseries("sum_session_errored_preaggr", [7.0]),
                _make_timeseries("errored_set_count", [4.0]),
                _make_timeseries("sum_session_abnormal", [2.0]),
                _make_timeseries("sum_session_unhandled", [5.0]),
            ]
        )

        result = _transform_eap_response(
            response,
            **_default_transform_kwargs(raw_groupby=["session.status"]),
        )
        groups_by_status = {g["by"]["session.status"]: g for g in result["groups"]}

        assert groups_by_status["healthy"]["totals"]["sum(session)"] == 89.0
        assert groups_by_status["crashed"]["totals"]["sum(session)"] == 3.0
        assert groups_by_status["errored"]["totals"]["sum(session)"] == 6.0
        assert groups_by_status["abnormal"]["totals"]["sum(session)"] == 2.0
        assert groups_by_status["unhandled"]["totals"]["sum(session)"] == 5.0

    def test_empty_response(self) -> None:
        response = TimeSeriesResponse(result_timeseries=[])
        result = _transform_eap_response(response, **_default_transform_kwargs())
        assert result["groups"] == []

    def test_grouped_response(self) -> None:
        response = TimeSeriesResponse(
            result_timeseries=[
                _make_timeseries(
                    "sum_session_init",
                    [50.0],
                    group_by={"release": "1.0"},
                ),
                _make_timeseries(
                    "sum_session_init",
                    [30.0],
                    group_by={"release": "2.0"},
                ),
            ]
        )
        for status in ["crashed", "errored_preaggr", "abnormal", "unhandled"]:
            response.result_timeseries.append(
                _make_timeseries(
                    f"sum_session_{status}",
                    [0.0],
                    group_by={"release": "1.0"},
                )
            )
            response.result_timeseries.append(
                _make_timeseries(
                    f"sum_session_{status}",
                    [0.0],
                    group_by={"release": "2.0"},
                )
            )
        for release in ["1.0", "2.0"]:
            response.result_timeseries.append(
                _make_timeseries(
                    "errored_set_count",
                    [0.0],
                    group_by={"release": release},
                )
            )

        result = _transform_eap_response(
            response,
            **_default_transform_kwargs(raw_groupby=["release"]),
        )
        assert len(result["groups"]) == 2
        groups_by_release = {g["by"]["release"]: g for g in result["groups"]}
        assert groups_by_release["1.0"]["totals"]["sum(session)"] == 50.0
        assert groups_by_release["2.0"]["totals"]["sum(session)"] == 30.0


def _make_metrics_query(
    fields: list[tuple[str | None, str]],
    groupby: list[str] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    rollup: int = 3600,
    project_ids: list[int] | None = None,
) -> MagicMock:
    """Create a mock DeprecatingMetricsQuery for testing.

    fields: list of (op, metric_mri) tuples
    """
    mock = MagicMock()
    mock_fields = []
    for op, mri in fields:
        field = MagicMock()
        field.op = op
        field.metric_mri = mri
        if op:
            name_parts = mri.split("/")[-1].split("@")[0]
            field.alias = f"{op}(session.{name_parts})" if "session" in mri else f"{op}({mri})"
        else:
            name_parts = mri.split("/")[-1].split("@")[0]
            field.alias = f"session.{name_parts}" if "session" in mri else mri
        mock_fields.append(field)
    mock.select = mock_fields

    mock_groupby = []
    for gb_name in groupby or []:
        gb = MagicMock()
        gb.name = gb_name
        gb.field = gb_name
        mock_groupby.append(gb)
    mock.groupby = mock_groupby

    mock.start = start or ONE_HOUR_AGO
    mock.end = end or NOW

    granularity = MagicMock()
    granularity.granularity = rollup
    mock.granularity = granularity

    mock.project_ids = project_ids or [1]
    mock.where = []
    mock.include_totals = True
    mock.include_series = True

    return mock


class TestIsSessionMetricsQuery(TestCase):
    def test_session_all_is_session_query(self) -> None:
        query = _make_metrics_query([("sum", "e:sessions/all@none")])
        assert is_session_metrics_query(query) is True

    def test_crash_free_rate_is_session_query(self) -> None:
        query = _make_metrics_query([(None, "e:sessions/crash_free_rate@ratio")])
        assert is_session_metrics_query(query) is True

    def test_non_session_metric_is_not_session_query(self) -> None:
        query = _make_metrics_query([("avg", "d:transactions/duration@millisecond")])
        assert is_session_metrics_query(query) is False

    def test_mixed_fields_with_session(self) -> None:
        query = _make_metrics_query(
            [
                ("sum", "e:sessions/all@none"),
                ("avg", "d:transactions/duration@millisecond"),
            ]
        )
        assert is_session_metrics_query(query) is True


class TestGetSeriesEap(TestCase):
    @patch("sentry.release_health.eap_sessions_rollout.timeseries_rpc")
    def test_returns_result_with_metric_field_names(self, mock_rpc: MagicMock) -> None:
        query = _make_metrics_query([("sum", "e:sessions/all@none")])
        query.select[0].alias = "sum(session.all)"

        mock_rpc.return_value = [
            TimeSeriesResponse(
                result_timeseries=[
                    _make_timeseries("sum_session_init", [100.0]),
                ]
            )
        ]

        result = get_series_eap(query, org_id=1)
        assert result is not None
        assert len(result["groups"]) == 1
        group = result["groups"][0]
        assert "sum(session.all)" in group["series"]
        assert "sum(session.all)" in group["totals"]

    @patch("sentry.release_health.eap_sessions_rollout.timeseries_rpc")
    def test_remaps_project_groupby(self, mock_rpc: MagicMock) -> None:
        query = _make_metrics_query(
            [("sum", "e:sessions/all@none")],
            groupby=["project_id"],
        )
        query.select[0].alias = "sum(session.all)"

        mock_rpc.return_value = [
            TimeSeriesResponse(
                result_timeseries=[
                    _make_timeseries(
                        "sum_session_init",
                        [50.0],
                        group_by={"sentry.project_id": "1"},
                    ),
                ]
            )
        ]

        result = get_series_eap(query, org_id=1)
        assert result is not None
        group = result["groups"][0]
        assert "project_id" in group["by"]
        assert "project" not in group["by"]

    @patch("sentry.release_health.eap_sessions_rollout.timeseries_rpc")
    def test_strips_totals_when_include_totals_false(self, mock_rpc: MagicMock) -> None:
        query = _make_metrics_query([("sum", "e:sessions/all@none")])
        query.select[0].alias = "sum(session.all)"
        query.include_totals = False

        mock_rpc.return_value = [
            TimeSeriesResponse(result_timeseries=[_make_timeseries("sum_session_init", [100.0])])
        ]

        result = get_series_eap(query, org_id=1)
        assert result is not None
        group = result["groups"][0]
        assert "totals" not in group
        assert "series" in group

    @patch("sentry.release_health.eap_sessions_rollout.timeseries_rpc")
    def test_returns_float_values(self, mock_rpc: MagicMock) -> None:
        """get_series returns floats, so EAP results should too."""
        query = _make_metrics_query([("sum", "e:sessions/all@none")])
        query.select[0].alias = "sum(session.all)"

        mock_rpc.return_value = [
            TimeSeriesResponse(result_timeseries=[_make_timeseries("sum_session_init", [5.0])])
        ]

        result = get_series_eap(query, org_id=1)
        assert result is not None
        group = result["groups"][0]
        assert group["series"]["sum(session.all)"] == [5.0]
        assert isinstance(group["series"]["sum(session.all)"][0], float)
        assert group["totals"]["sum(session.all)"] == 5.0
        assert isinstance(group["totals"]["sum(session.all)"], float)

    def test_returns_none_for_non_session_query(self) -> None:
        query = _make_metrics_query([("avg", "d:transactions/duration@millisecond")])
        result = get_series_eap(query, org_id=1)
        assert result is None


class TestCompareGetSeriesResults(TestCase):
    """Tests use timestamps from 2025 (well in the past), so all buckets are old enough to compare."""

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_matching_results(self, mock_metrics: MagicMock) -> None:
        intervals = [isoformat_z(ONE_HOUR_AGO)]
        control = {
            "intervals": intervals,
            "groups": [
                {
                    "by": {},
                    "series": {"sum(session.all)": [100]},
                    "totals": {"sum(session.all)": 100},
                }
            ],
        }
        experimental = {
            "intervals": intervals,
            "groups": [
                {
                    "by": {},
                    "series": {"sum(session.all)": [100]},
                    "totals": {"sum(session.all)": 100},
                }
            ],
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"match": "True", "is_null_result": "False"},
            sample_rate=1.0,
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_mismatched_results(self, mock_metrics: MagicMock) -> None:
        intervals = [isoformat_z(ONE_HOUR_AGO)]
        control = {
            "intervals": intervals,
            "groups": [
                {
                    "by": {},
                    "series": {"sum(session.all)": [100]},
                    "totals": {"sum(session.all)": 100},
                }
            ],
        }
        experimental = {
            "intervals": intervals,
            "groups": [
                {"by": {}, "series": {"sum(session.all)": [50]}, "totals": {"sum(session.all)": 50}}
            ],
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"match": "False", "is_null_result": "False"},
            sample_rate=1.0,
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_null_eap_result(self, mock_metrics: MagicMock) -> None:
        intervals = [isoformat_z(ONE_HOUR_AGO)]
        control = {
            "intervals": intervals,
            "groups": [
                {
                    "by": {},
                    "series": {"sum(session.all)": [100]},
                    "totals": {"sum(session.all)": 100},
                }
            ],
        }
        experimental: dict[str, list[object]] = {"groups": []}
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"match": "False", "is_null_result": "True"},
            sample_rate=1.0,
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_structural_mismatch_is_detected(self, mock_metrics: MagicMock) -> None:
        """Series key mismatch between control and experimental should be detected."""
        intervals = [isoformat_z(ONE_HOUR_AGO)]
        control = {
            "intervals": intervals,
            "groups": [{"by": {}, "series": {"session.all": [5.0]}}],
        }
        experimental = {
            "intervals": intervals,
            "groups": [{"by": {}, "series": {"session.all": [5.0], "extra_field": [1.0]}}],
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"match": "False", "is_null_result": "False"},
            sample_rate=1.0,
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_skips_comparison_when_all_data_recent(self, mock_metrics: MagicMock) -> None:
        """When all intervals are within the freshness buffer, comparison is skipped."""
        now = datetime.now(timezone.utc)
        recent_intervals = [
            isoformat_z(now - timedelta(minutes=10)),
            isoformat_z(now - timedelta(minutes=5)),
            isoformat_z(now),
        ]
        control = {
            "intervals": recent_intervals,
            "groups": [{"by": {}, "series": {"sum(session.all)": [100, 200, 300]}}],
        }
        experimental = {
            "intervals": recent_intervals,
            "groups": [{"by": {}, "series": {"sum(session.all)": [999, 999, 999]}}],
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"match": "skipped", "is_null_result": "False"},
            sample_rate=1.0,
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_only_compares_old_buckets(self, mock_metrics: MagicMock) -> None:
        """Old buckets match but recent ones differ — should report match."""
        now = datetime.now(timezone.utc)
        old_ts = now - _FRESHNESS_BUFFER - timedelta(hours=1)
        recent_ts = now - timedelta(minutes=5)
        intervals = [isoformat_z(old_ts), isoformat_z(recent_ts)]
        control = {
            "intervals": intervals,
            "groups": [{"by": {}, "series": {"sum(session.all)": [100, 200]}}],
        }
        experimental = {
            "intervals": intervals,
            "groups": [{"by": {}, "series": {"sum(session.all)": [100, 999]}}],
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"match": "True", "is_null_result": "False"},
            sample_rate=1.0,
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_mismatch_in_old_buckets(self, mock_metrics: MagicMock) -> None:
        """Old buckets differ — should report mismatch."""
        now = datetime.now(timezone.utc)
        old_ts = now - _FRESHNESS_BUFFER - timedelta(hours=1)
        recent_ts = now - timedelta(minutes=5)
        intervals = [isoformat_z(old_ts), isoformat_z(recent_ts)]
        control = {
            "intervals": intervals,
            "groups": [{"by": {}, "series": {"sum(session.all)": [100, 200]}}],
        }
        experimental = {
            "intervals": intervals,
            "groups": [{"by": {}, "series": {"sum(session.all)": [999, 200]}}],
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"match": "False", "is_null_result": "False"},
            sample_rate=1.0,
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_datetime_intervals(self, mock_metrics: MagicMock) -> None:
        """Intervals passed as datetime objects (from metrics pipeline) should work."""
        intervals = [ONE_HOUR_AGO]
        control = {
            "intervals": intervals,
            "groups": [{"by": {}, "series": {"sum(session.all)": [100]}}],
        }
        experimental = {
            "intervals": intervals,
            "groups": [{"by": {}, "series": {"sum(session.all)": [100]}}],
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"match": "True", "is_null_result": "False"},
            sample_rate=1.0,
        )
