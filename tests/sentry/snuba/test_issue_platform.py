from __future__ import annotations

from datetime import timedelta
from unittest.mock import Mock, patch

from sentry.search.events.types import SnubaParams
from sentry.snuba import issue_platform
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class _FakeDiscoverBuilder:
    tips = {"query": set(), "columns": set()}

    def __init__(self, *args, **kwargs):
        pass

    def add_conditions(self, conditions):
        pass

    def run_query(self, referrer, query_source=None):
        return {
            "data": [{"id": "control-event", "count()": 1}],
            "meta": {"fields": {"id": "string", "count()": "integer"}},
        }

    def process_results(self, result):
        return result

    def get_snql_query(self):
        return Mock(query="SELECT 1")


class _FakeTimeseriesBuilder:
    tips = {"query": set(), "columns": set()}

    class _params:
        start = before_now(hours=1)
        end = before_now(minutes=1)

    params = _params()
    aggregates = [Mock(alias="count()")]

    def __init__(self, *args, **kwargs):
        pass

    def get_snql_query(self):
        return Mock(query="SELECT 1")

    def process_results(self, result):
        return result


# ── PR 1: query() tests ───────────────────────────────────────────────


class IssuePlatformQueryTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.snuba_params = SnubaParams(
            start=before_now(hours=1),
            end=before_now(minutes=1),
            organization=self.organization,
            projects=[self.project],
            environments=[],
        )

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_uses_stable_callsite(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_table_query: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        run_table_query.return_value = {
            "data": [{"id": "exp-event", "count()": 1}],
            "meta": {"fields": {"id": "string", "count()": "integer"}},
        }
        check_and_choose.return_value = [{"id": "control-event", "count()": 1}]

        issue_platform.query(
            selected_columns=["id", "count()"],
            query="",
            snuba_params=self.snuba_params,
            limit=10,
            referrer="api.organization-issue-replay-count",
        )

        expected_callsite = "snuba.issue_platform.query"
        should_check_experiment.assert_called_once_with(expected_callsite)
        assert check_and_choose.call_args.args[2] == expected_callsite
        assert check_and_choose.call_args.kwargs["debug_context"]["referrer"] == (
            "api.organization-issue-replay-count"
        )

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_runs_experimental_even_with_conditions(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_table_query: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        run_table_query.return_value = {
            "data": [{"id": "exp-event", "count()": 1}],
            "meta": {"fields": {"id": "string", "count()": "integer"}},
        }
        check_and_choose.return_value = [{"id": "control-event", "count()": 1}]

        issue_platform.query(
            selected_columns=["id", "count()"],
            query="",
            snuba_params=self.snuba_params,
            conditions=[["foo", "=", "bar"]],
            referrer="api.organization-events",
        )

        should_check_experiment.assert_called_once()
        run_table_query.assert_called_once()

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_can_return_experimental_rows_when_chosen(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_table_query: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        experimental_rows = [{"id": "exp-event", "count()": 1}]
        run_table_query.return_value = {
            "data": experimental_rows,
            "meta": {"fields": {"id": "string", "count()": "integer"}},
        }
        check_and_choose.return_value = experimental_rows

        result = issue_platform.query(
            selected_columns=["id", "count()"],
            query="",
            snuba_params=self.snuba_params,
            limit=10,
            referrer="api.organization-events",
        )

        assert result["data"] == experimental_rows

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_normalizes_issue_id_from_eap_response(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_table_query: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        run_table_query.return_value = {
            "data": [{"group_id": 17, "count()": 2}],
            "meta": {"fields": {"group_id": "integer", "count()": "integer"}},
            "confidence": [],
        }
        check_and_choose.side_effect = lambda _ctl, exp, *_args, **_kwargs: exp

        result = issue_platform.query(
            selected_columns=["issue.id", "count()"],
            query="issue.id:17",
            snuba_params=self.snuba_params,
            referrer="api.organization-events",
            limit=10,
        )

        assert result["data"] == [{"issue.id": 17, "count()": 2}]

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_eap_failure_falls_back_to_control(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_table_query: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        run_table_query.side_effect = Exception("EAP query failed")
        check_and_choose.return_value = [{"id": "control-event", "count()": 1}]

        result = issue_platform.query(
            selected_columns=["id", "count()"],
            query="",
            snuba_params=self.snuba_params,
            limit=10,
            referrer="api.organization-events",
        )

        assert result["data"] == [{"id": "control-event", "count()": 1}]
        assert check_and_choose.call_args.args[1] == []
        assert check_and_choose.call_args.kwargs["is_experimental_data_a_null_result"] is True


# ── PR 1: _table_subset_match tests ──────────────────────────────────


class TableSubsetMatchTest(TestCase):
    def test_empty_experimental_rows_match(self) -> None:
        assert issue_platform._table_subset_match([{"id": "a"}], [])

    def test_id_subset_match(self) -> None:
        control = [{"id": "a"}, {"id": "b"}]
        assert issue_platform._table_subset_match(control, [{"id": "a"}])
        assert not issue_platform._table_subset_match(control, [{"id": "c"}])

    def test_count_subset_match(self) -> None:
        control = [
            {"project.id": "1", "count()": 4},
            {"project.id": "2", "count()": 2},
        ]
        experimental = [
            {"project.id": "1", "count()": 3},
            {"project.id": "2", "count()": 1},
        ]
        assert issue_platform._table_subset_match(control, experimental)
        assert not issue_platform._table_subset_match(control, [{"project.id": "1", "count()": 5}])

    def test_fallback_row_count(self) -> None:
        control = [{"foo": "a"}, {"foo": "b"}]
        assert issue_platform._table_subset_match(control, [{"foo": "a"}])
        assert not issue_platform._table_subset_match(
            control, [{"foo": "a"}, {"foo": "b"}, {"foo": "c"}]
        )


# ── PR 2: timeseries_query() tests ───────────────────────────────────


class IssuePlatformTimeseriesQueryTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.snuba_params = SnubaParams(
            start=before_now(hours=6),
            end=before_now(minutes=1),
            organization=self.organization,
            projects=[self.project],
            environments=[],
        )

    @patch(
        "sentry.snuba.issue_platform.IssuePlatformTimeseriesQueryBuilder",
        new=_FakeTimeseriesBuilder,
    )
    @patch("sentry.snuba.issue_platform.bulk_snuba_queries")
    @patch("sentry.snuba.issue_platform._run_eap_timeseries")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_timeseries_uses_stable_callsite(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_eap_timeseries: Mock,
        bulk_snuba_queries_mock: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        bulk_snuba_queries_mock.return_value = [
            {"data": [{"time": 1000, "count()": 5}], "meta": {}}
        ]
        run_eap_timeseries.return_value = [{"time": 1000, "count()": 3}]
        check_and_choose.return_value = [{"time": 1000, "count()": 5}]

        issue_platform.timeseries_query(
            selected_columns=["count()"],
            query="",
            snuba_params=self.snuba_params,
            rollup=3600,
            referrer="api.organization-events-stats",
        )

        expected_callsite = "snuba.issue_platform.timeseries_query"
        should_check_experiment.assert_called_once_with(expected_callsite)
        assert check_and_choose.call_args.args[2] == expected_callsite
        assert check_and_choose.call_args.kwargs["debug_context"]["referrer"] == (
            "api.organization-events-stats"
        )

    @patch(
        "sentry.snuba.issue_platform.IssuePlatformTimeseriesQueryBuilder",
        new=_FakeTimeseriesBuilder,
    )
    @patch("sentry.snuba.issue_platform.bulk_snuba_queries")
    @patch("sentry.snuba.issue_platform._run_eap_timeseries")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_timeseries_skips_experimental_when_disabled(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_eap_timeseries: Mock,
        bulk_snuba_queries_mock: Mock,
    ) -> None:
        should_check_experiment.return_value = False
        bulk_snuba_queries_mock.return_value = [
            {"data": [{"time": 1000, "count()": 5}], "meta": {}}
        ]

        issue_platform.timeseries_query(
            selected_columns=["count()"],
            query="",
            snuba_params=self.snuba_params,
            rollup=3600,
            referrer="api.organization-events-stats",
        )

        run_eap_timeseries.assert_not_called()
        check_and_choose.assert_not_called()

    @patch(
        "sentry.snuba.issue_platform.IssuePlatformTimeseriesQueryBuilder",
        new=_FakeTimeseriesBuilder,
    )
    @patch("sentry.snuba.issue_platform.bulk_snuba_queries")
    @patch("sentry.snuba.issue_platform._run_eap_timeseries")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_timeseries_eap_failure_falls_back_to_control(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_eap_timeseries: Mock,
        bulk_snuba_queries_mock: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        control_data = [{"time": 1000, "count()": 5}]
        bulk_snuba_queries_mock.return_value = [{"data": control_data, "meta": {}}]
        run_eap_timeseries.side_effect = Exception("EAP query failed")
        check_and_choose.return_value = control_data

        result = issue_platform.timeseries_query(
            selected_columns=["count()"],
            query="",
            snuba_params=self.snuba_params,
            rollup=3600,
            referrer="api.organization-events-stats",
        )

        assert result.data["data"] == control_data
        assert check_and_choose.call_args.args[1] == []
        assert check_and_choose.call_args.kwargs["is_experimental_data_a_null_result"] is True

    @patch(
        "sentry.snuba.issue_platform.IssuePlatformTimeseriesQueryBuilder",
        new=_FakeTimeseriesBuilder,
    )
    @patch("sentry.snuba.issue_platform.bulk_snuba_queries")
    @patch("sentry.snuba.issue_platform._run_eap_timeseries")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_timeseries_passes_comparison_delta_to_eap(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_eap_timeseries: Mock,
        bulk_snuba_queries_mock: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        bulk_snuba_queries_mock.return_value = [
            {"data": [{"time": 1000, "count()": 5}], "meta": {}},
            {"data": [{"time": 500, "count()": 3}], "meta": {}},
        ]
        eap_data = [{"time": 1000, "count()": 4, "comparisonCount": 2}]
        run_eap_timeseries.return_value = eap_data
        check_and_choose.return_value = [{"time": 1000, "count()": 5, "comparisonCount": 3}]

        delta = timedelta(days=1)
        issue_platform.timeseries_query(
            selected_columns=["count()"],
            query="",
            snuba_params=self.snuba_params,
            rollup=3600,
            comparison_delta=delta,
            referrer="api.organization-events-stats",
        )

        run_eap_timeseries.assert_called_once()
        call_kwargs = run_eap_timeseries.call_args.kwargs
        assert call_kwargs["comparison_delta"] == delta
        assert check_and_choose.call_args.kwargs["debug_context"]["comparison_delta"] == str(delta)

    @patch(
        "sentry.snuba.issue_platform.IssuePlatformTimeseriesQueryBuilder",
        new=_FakeTimeseriesBuilder,
    )
    @patch("sentry.snuba.issue_platform.bulk_snuba_queries")
    @patch("sentry.snuba.issue_platform._run_eap_timeseries")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_timeseries_can_return_experimental_data_when_chosen(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_eap_timeseries: Mock,
        bulk_snuba_queries_mock: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        bulk_snuba_queries_mock.return_value = [
            {"data": [{"time": 1000, "count()": 5}], "meta": {}}
        ]
        eap_data = [{"time": 1000, "count()": 4}]
        run_eap_timeseries.return_value = eap_data
        check_and_choose.return_value = eap_data

        result = issue_platform.timeseries_query(
            selected_columns=["count()"],
            query="",
            snuba_params=self.snuba_params,
            rollup=3600,
            referrer="api.organization-events-stats",
        )

        assert result.data["data"] == eap_data


# ── PR 2: _timeseries_subset_match tests ─────────────────────────────


class TimeseriesSubsetMatchTest(TestCase):
    def test_empty_experimental_matches(self) -> None:
        assert issue_platform._timeseries_subset_match([{"time": 1000, "count()": 5}], [])

    def test_eap_values_within_control(self) -> None:
        control = [
            {"time": 1000, "count()": 5},
            {"time": 2000, "count()": 10},
        ]
        experimental = [
            {"time": 1000, "count()": 3},
            {"time": 2000, "count()": 8},
        ]
        assert issue_platform._timeseries_subset_match(control, experimental)

    def test_eap_value_exceeds_control(self) -> None:
        control = [{"time": 1000, "count()": 5}]
        experimental = [{"time": 1000, "count()": 6}]
        assert not issue_platform._timeseries_subset_match(control, experimental)

    def test_eap_bucket_missing_from_control(self) -> None:
        control = [{"time": 1000, "count()": 5}]
        experimental = [{"time": 2000, "count()": 1}]
        assert not issue_platform._timeseries_subset_match(control, experimental)

    def test_non_numeric_fields_ignored(self) -> None:
        control = [{"time": 1000, "count()": 5, "label": "foo"}]
        experimental = [{"time": 1000, "count()": 3, "label": "bar"}]
        assert issue_platform._timeseries_subset_match(control, experimental)

    def test_multiple_aggregates(self) -> None:
        control = [{"time": 1000, "count()": 5, "avg(duration)": 100.0}]
        experimental = [{"time": 1000, "count()": 4, "avg(duration)": 90.0}]
        assert issue_platform._timeseries_subset_match(control, experimental)

        over = [{"time": 1000, "count()": 4, "avg(duration)": 110.0}]
        assert not issue_platform._timeseries_subset_match(control, over)


# ── PR 2: _run_eap_timeseries tests ──────────────────────────────────


class RunEapTimeseriesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.snuba_params = SnubaParams(
            start=before_now(hours=2),
            end=before_now(minutes=1),
            organization=self.organization,
            projects=[self.project],
            environments=[],
        )

    @patch("sentry.snuba.issue_platform.zerofill")
    @patch("sentry.snuba.issue_platform.Occurrences.run_grouped_timeseries_query")
    def test_basic_timeseries_with_zerofill(
        self,
        run_grouped_ts: Mock,
        zerofill_mock: Mock,
    ) -> None:
        raw = [{"time": 1000, "count()": 5}]
        run_grouped_ts.return_value = raw
        filled = [{"time": 1000, "count()": 5}, {"time": 2000, "count()": 0}]
        zerofill_mock.return_value = filled

        result = issue_platform._run_eap_timeseries(
            snuba_params=self.snuba_params,
            query_string="",
            y_axes=["count()"],
            referrer="test",
            rollup=3600,
            zerofill_results=True,
        )

        run_grouped_ts.assert_called_once()
        zerofill_mock.assert_called_once()
        assert result == filled

    @patch("sentry.snuba.issue_platform.zerofill")
    @patch("sentry.snuba.issue_platform.Occurrences.run_grouped_timeseries_query")
    def test_no_zerofill(
        self,
        run_grouped_ts: Mock,
        zerofill_mock: Mock,
    ) -> None:
        raw = [{"time": 1000, "count()": 5}]
        run_grouped_ts.return_value = raw

        result = issue_platform._run_eap_timeseries(
            snuba_params=self.snuba_params,
            query_string="",
            y_axes=["count()"],
            referrer="test",
            rollup=3600,
            zerofill_results=False,
        )

        zerofill_mock.assert_not_called()
        assert result == raw

    @patch("sentry.snuba.issue_platform.zerofill", side_effect=lambda data, *a, **k: data)
    @patch("sentry.snuba.issue_platform.Occurrences.run_grouped_timeseries_query")
    def test_comparison_delta_attaches_comparison_count(
        self,
        run_grouped_ts: Mock,
        zerofill_mock: Mock,
    ) -> None:
        # Comparison rows are aligned positionally (matching control path's zip behavior).
        base_rows = [{"time": 1000, "count()": 5}]
        comp_rows = [{"time": 900, "count()": 3}]
        run_grouped_ts.side_effect = [base_rows, comp_rows]

        result = issue_platform._run_eap_timeseries(
            snuba_params=self.snuba_params,
            query_string="",
            y_axes=["count()"],
            referrer="test",
            rollup=3600,
            zerofill_results=True,
            comparison_delta=timedelta(days=1),
        )

        assert run_grouped_ts.call_count == 2
        assert result[0]["comparisonCount"] == 3

    @patch("sentry.snuba.issue_platform.zerofill", side_effect=lambda data, *a, **k: data)
    @patch("sentry.snuba.issue_platform.Occurrences.run_grouped_timeseries_query")
    def test_comparison_delta_zero_when_bucket_missing(
        self,
        run_grouped_ts: Mock,
        zerofill_mock: Mock,
    ) -> None:
        base_rows = [{"time": 1000, "count()": 5}]
        comp_rows: list[dict] = []
        run_grouped_ts.side_effect = [base_rows, comp_rows]

        result = issue_platform._run_eap_timeseries(
            snuba_params=self.snuba_params,
            query_string="",
            y_axes=["count()"],
            referrer="test",
            rollup=3600,
            zerofill_results=True,
            comparison_delta=timedelta(days=1),
        )

        assert result[0]["comparisonCount"] == 0
