from __future__ import annotations

from datetime import datetime, timedelta, timezone
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
    _build_eap_timeseries_request,
    _transform_eap_response,
    _translate_metrics_query,
    compare_get_series_results,
    get_series_eap,
    is_session_metrics_query,
)
from sentry.testutils.cases import TestCase

NOW = datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
ONE_HOUR_AGO = NOW - timedelta(hours=1)


def _make_query(
    raw_fields: list[str],
    raw_groupby: list[str] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    rollup: int = 3600,
    project_ids: list[int] | None = None,
    query: str = "",
) -> MagicMock:
    """Create a mock QueryDefinition."""
    mock = MagicMock()
    mock.raw_fields = raw_fields
    mock.raw_groupby = raw_groupby or []
    mock.start = start or ONE_HOUR_AGO
    mock.end = end or NOW
    mock.rollup = rollup
    mock.params = {"project_id": project_ids or [1]}
    mock.query = query
    mock.get_filter_conditions.return_value = []
    return mock


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


class TestBuildEapRequest(TestCase):
    def test_sum_session(self):
        query = _make_query(["sum(session)"])
        request = _build_eap_timeseries_request(org_id=1, query=query)

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

    def test_count_unique_user(self):
        query = _make_query(["count_unique(user)"])
        request = _build_eap_timeseries_request(org_id=1, query=query)

        labels = [expr.label for expr in request.expressions]
        assert "uniq_user_all" in labels
        # init should not be requested — user set items don't have init status
        assert "uniq_user_init" not in labels

        for expr in request.expressions:
            if expr.label == "uniq_user_all":
                agg = expr.aggregation
                assert agg.aggregate == Function.FUNCTION_UNIQ
                assert agg.key.name == "user_id_hash"
                assert agg.key.type == AttributeKey.Type.TYPE_ARRAY

    def test_crash_free_rate(self):
        query = _make_query(["crash_free_rate(session)"])
        request = _build_eap_timeseries_request(org_id=1, query=query)

        labels = [expr.label for expr in request.expressions]
        assert "sum_session_init" in labels
        assert "sum_session_crashed" in labels

    def test_with_groupby(self):
        query = _make_query(["sum(session)"], raw_groupby=["project", "release", "environment"])
        request = _build_eap_timeseries_request(org_id=1, query=query)

        group_by_names = [gb.name for gb in request.group_by]
        assert "sentry.project_id" in group_by_names
        assert "release" in group_by_names
        assert "environment" in group_by_names

    def test_with_status_groupby(self):
        query = _make_query(["sum(session)"], raw_groupby=["session.status"])
        request = _build_eap_timeseries_request(org_id=1, query=query)

        labels = [expr.label for expr in request.expressions]
        for status in ["init", "crashed", "errored_preaggr", "abnormal", "unhandled"]:
            assert f"sum_session_{status}" in labels
        assert "errored_set_count" in labels

        # session.status should NOT be in group_by (handled in post-processing)
        group_by_names = [gb.name for gb in request.group_by]
        assert "session.status" not in group_by_names
        assert "status" not in group_by_names


class TestTransformResponse(TestCase):
    def test_basic_sum_session(self):
        query = _make_query(["sum(session)"])
        response = TimeSeriesResponse(
            result_timeseries=[
                _make_timeseries("sum_session_init", [100.0]),
            ]
        )

        result = _transform_eap_response(response, query)
        assert len(result["groups"]) == 1
        group = result["groups"][0]
        assert group["series"]["sum(session)"] == [100.0]
        assert group["totals"]["sum(session)"] == 100.0

    def test_crash_free_rate(self):
        query = _make_query(["crash_free_rate(session)"])
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

        result = _transform_eap_response(response, query)
        group = result["groups"][0]
        assert group["totals"]["crash_free_rate(session)"] == pytest.approx(0.95)
        assert group["series"]["crash_free_rate(session)"] == [pytest.approx(0.95)]

    def test_healthy_computation(self):
        query = _make_query(["sum(session)"], raw_groupby=["session.status"])
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

        result = _transform_eap_response(response, query)
        groups_by_status = {g["by"]["session.status"]: g for g in result["groups"]}

        # errored_all = errored_preaggr + errored_set = 7 + 4 = 11
        # healthy = init - errored_all = 100 - 11 = 89
        assert groups_by_status["healthy"]["totals"]["sum(session)"] == 89.0
        assert groups_by_status["crashed"]["totals"]["sum(session)"] == 3.0
        # errored = errored_all - crashed - abnormal = 11 - 3 - 2 = 6
        assert groups_by_status["errored"]["totals"]["sum(session)"] == 6.0
        assert groups_by_status["abnormal"]["totals"]["sum(session)"] == 2.0
        assert groups_by_status["unhandled"]["totals"]["sum(session)"] == 5.0

    def test_empty_response(self):
        query = _make_query(["sum(session)"])
        response = TimeSeriesResponse(result_timeseries=[])
        result = _transform_eap_response(response, query)
        assert result["groups"] == []

    def test_grouped_response(self):
        query = _make_query(["sum(session)"], raw_groupby=["release"])
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

        result = _transform_eap_response(response, query)
        assert len(result["groups"]) == 2
        groups_by_release = {g["by"]["release"]: g for g in result["groups"]}
        assert groups_by_release["1.0"]["totals"]["sum(session)"] == 50.0
        assert groups_by_release["2.0"]["totals"]["sum(session)"] == 30.0


class TestDoubleRead(TestCase):
    @patch("sentry.release_health.eap_sessions_rollout.run_sessions_query_eap")
    def test_flag_off_no_eap_query(self, mock_eap_query):
        """When feature flag is off, EAP query is never called."""
        from sentry.release_health.metrics import MetricsReleaseHealthBackend

        backend = MetricsReleaseHealthBackend()
        query = _make_query(["sum(session)"])

        control_result = {
            "start": ONE_HOUR_AGO,
            "end": NOW,
            "intervals": [],
            "groups": [
                {"by": {}, "series": {"sum(session)": [100.0]}, "totals": {"sum(session)": 100.0}}
            ],
            "query": "",
        }

        with patch("sentry.release_health.metrics.run_sessions_query", return_value=control_result):
            with self.feature({"organizations:session-health-eap": False}):
                result = backend.run_sessions_query(self.organization.id, query, "test")

        assert result == control_result
        mock_eap_query.assert_not_called()

    @patch("sentry.release_health.eap_sessions_rollout.timeseries_rpc")
    def test_flag_on_returns_control(self, mock_rpc):
        """When flag is on, always returns control data."""
        from sentry.release_health.metrics import MetricsReleaseHealthBackend

        backend = MetricsReleaseHealthBackend()
        query = _make_query(["sum(session)"])

        control_result = {
            "start": ONE_HOUR_AGO,
            "end": NOW,
            "intervals": [],
            "groups": [
                {"by": {}, "series": {"sum(session)": [100.0]}, "totals": {"sum(session)": 100.0}}
            ],
            "query": "",
        }

        mock_rpc.return_value = [TimeSeriesResponse(result_timeseries=[])]

        with patch("sentry.release_health.metrics.run_sessions_query", return_value=control_result):
            with self.feature({"organizations:session-health-eap": True}):
                result = backend.run_sessions_query(self.organization.id, query, "test")

        assert result == control_result

    @patch(
        "sentry.release_health.eap_sessions_rollout.timeseries_rpc",
        side_effect=Exception("EAP is down"),
    )
    def test_eap_failure_returns_control(self, mock_rpc):
        """EAP failure does not affect response — control data is returned."""
        from sentry.release_health.metrics import MetricsReleaseHealthBackend

        backend = MetricsReleaseHealthBackend()
        query = _make_query(["sum(session)"])

        control_result = {
            "start": ONE_HOUR_AGO,
            "end": NOW,
            "intervals": [],
            "groups": [
                {"by": {}, "series": {"sum(session)": [100.0]}, "totals": {"sum(session)": 100.0}}
            ],
            "query": "",
        }

        with patch("sentry.release_health.metrics.run_sessions_query", return_value=control_result):
            with self.feature({"organizations:session-health-eap": True}):
                result = backend.run_sessions_query(self.organization.id, query, "test")

        assert result == control_result


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
    def test_session_all_is_session_query(self):
        query = _make_metrics_query([("sum", "e:sessions/all@none")])
        assert is_session_metrics_query(query) is True

    def test_crash_free_rate_is_session_query(self):
        query = _make_metrics_query([(None, "e:sessions/crash_free_rate@ratio")])
        assert is_session_metrics_query(query) is True

    def test_non_session_metric_is_not_session_query(self):
        query = _make_metrics_query([("avg", "d:transactions/duration@millisecond")])
        assert is_session_metrics_query(query) is False

    def test_mixed_fields_with_session(self):
        query = _make_metrics_query(
            [
                ("sum", "e:sessions/all@none"),
                ("avg", "d:transactions/duration@millisecond"),
            ]
        )
        assert is_session_metrics_query(query) is True


class TestTranslateMetricsQuery(TestCase):
    def test_translates_sum_session_all(self):
        query = _make_metrics_query([("sum", "e:sessions/all@none")])
        result = _translate_metrics_query(query)
        assert result is not None
        adapter, field_mapping = result
        assert adapter.raw_fields == ["sum(session)"]
        assert "sum(session)" in field_mapping

    def test_translates_crash_free_rate(self):
        query = _make_metrics_query([(None, "e:sessions/crash_free_rate@ratio")])
        result = _translate_metrics_query(query)
        assert result is not None
        adapter, field_mapping = result
        assert adapter.raw_fields == ["crash_free_rate(session)"]

    def test_translates_groupby(self):
        query = _make_metrics_query(
            [("sum", "e:sessions/all@none")],
            groupby=["project_id", "release"],
        )
        result = _translate_metrics_query(query)
        assert result is not None
        adapter, _ = result
        assert adapter.raw_groupby == ["project", "release"]

    def test_returns_none_for_unknown_mri(self):
        query = _make_metrics_query([("avg", "d:transactions/duration@millisecond")])
        assert _translate_metrics_query(query) is None

    def test_returns_none_for_unknown_groupby(self):
        query = _make_metrics_query(
            [("sum", "e:sessions/all@none")],
            groupby=["unknown_field"],
        )
        assert _translate_metrics_query(query) is None

    def test_adapter_has_correct_time_range(self):
        query = _make_metrics_query(
            [("sum", "e:sessions/all@none")],
            start=ONE_HOUR_AGO,
            end=NOW,
            rollup=3600,
            project_ids=[1, 2],
        )
        result = _translate_metrics_query(query)
        assert result is not None
        adapter, _ = result
        assert adapter.start == ONE_HOUR_AGO
        assert adapter.end == NOW
        assert adapter.rollup == 3600
        assert adapter.params["project_id"] == [1, 2]


class TestGetSeriesEap(TestCase):
    @patch("sentry.release_health.eap_sessions_rollout.timeseries_rpc")
    def test_returns_result_with_metric_field_names(self, mock_rpc):
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
    def test_remaps_project_groupby(self, mock_rpc):
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
    def test_strips_totals_when_include_totals_false(self, mock_rpc):
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
    def test_returns_float_values(self, mock_rpc):
        """get_series returns floats, so EAP results should too."""
        query = _make_metrics_query([("sum", "e:sessions/all@none")])
        query.select[0].alias = "sum(session.all)"

        mock_rpc.return_value = [
            TimeSeriesResponse(result_timeseries=[_make_timeseries("sum_session_init", [5.0])])
        ]

        result = get_series_eap(query, org_id=1)
        assert result is not None
        group = result["groups"][0]
        # Values should be float, not int
        assert group["series"]["sum(session.all)"] == [5.0]
        assert isinstance(group["series"]["sum(session.all)"][0], float)
        assert group["totals"]["sum(session.all)"] == 5.0
        assert isinstance(group["totals"]["sum(session.all)"], float)

    def test_returns_none_for_non_session_query(self):
        query = _make_metrics_query([("avg", "d:transactions/duration@millisecond")])
        result = get_series_eap(query, org_id=1)
        assert result is None


class TestCompareGetSeriesResults(TestCase):
    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_matching_results(self, mock_metrics):
        control = {
            "groups": [
                {
                    "by": {},
                    "series": {"sum(session.all)": [100]},
                    "totals": {"sum(session.all)": 100},
                }
            ]
        }
        experimental = {
            "groups": [
                {
                    "by": {},
                    "series": {"sum(session.all)": [100]},
                    "totals": {"sum(session.all)": 100},
                }
            ]
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"exact_match": "True", "is_null_result": "False"},
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_mismatched_results(self, mock_metrics):
        control = {
            "groups": [
                {
                    "by": {},
                    "series": {"sum(session.all)": [100]},
                    "totals": {"sum(session.all)": 100},
                }
            ]
        }
        experimental = {
            "groups": [
                {"by": {}, "series": {"sum(session.all)": [50]}, "totals": {"sum(session.all)": 50}}
            ]
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"exact_match": "False", "is_null_result": "False"},
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_null_eap_result(self, mock_metrics):
        control = {
            "groups": [
                {
                    "by": {},
                    "series": {"sum(session.all)": [100]},
                    "totals": {"sum(session.all)": 100},
                }
            ]
        }
        experimental = {"groups": []}
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"exact_match": "False", "is_null_result": "True"},
        )

    @patch("sentry.release_health.eap_sessions_rollout.metrics")
    def test_structural_mismatch_is_detected(self, mock_metrics):
        """Extra totals in experimental that control doesn't have should mismatch."""
        control = {"groups": [{"by": {}, "series": {"session.all": [5.0]}}]}
        experimental = {
            "groups": [{"by": {}, "series": {"session.all": [5.0]}, "totals": {"session.all": 5.0}}]
        }
        compare_get_series_results(control, experimental)
        mock_metrics.incr.assert_called_once_with(
            "eap_sessions.get_series_compare",
            tags={"exact_match": "False", "is_null_result": "False"},
        )
