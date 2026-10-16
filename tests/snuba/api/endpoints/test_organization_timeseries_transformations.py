from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase
from tests.snuba.api.endpoints.test_organization_events_timeseries_spans import (
    any_confidence,
    build_expected_timeseries,
)

pytestmark = pytest.mark.sentry_metrics


class OrganizationTimeseriesTransformationsTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-timeseries"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=6)
        self.two_days_ago = self.start - timedelta(days=1)
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client_get(data=data, url=self.url if url is None else url)

    def _store_spans_in_buckets(
        self, counts, start, description="foo", interval_seconds=3600
    ) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": description},
                    start_ts=start + timedelta(seconds=bucket * interval_seconds + offset),
                )
                for bucket, count in enumerate(counts)
                for offset in range(count)
            ]
        )

    def test_transformations_preserve_duplicate_untransformed_axis(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        cases = [
            (["fill(locf)"], [2, 2, 6, 4, 4, 4]),
            (["fill(zero)"], [2, 0, 6, 4, 0, 0]),
            (["fill(linear)"], [2, 4, 6, 4, None, None]),
            (["smooth(sma,2)"], [2, None, 6, 5, None, None]),
            (["smooth(ema,3)"], [2, None, 4, 4, None, None]),
            (["fill(locf)", "smooth(sma,2)"], [2, 2, 4, 5, 4, 4]),
            (["smooth(sma,2)", "fill(locf)"], [2, 2, 6, 5, 5, 5]),
        ]
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start, interval_seconds=15)
        for transformations, expected in cases:
            response = self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "15s",
                    "yAxis": ["count()", "count()"],
                    "project": self.project.id,
                    "dataset": "spans",
                    "transformations[0]": transformations,
                },
                features={"organizations:explore-interpolation-and-smoothing": True},
            )

            assert response.status_code == 200, response.content
            transformed, untransformed = response.data["timeSeries"]
            assert transformed["yAxis"] == untransformed["yAxis"] == "count()"
            assert transformed["values"] == build_expected_timeseries(
                self.start,
                15_000,
                expected,
                sample_count=[2, 0, 6, 4, 0, 0],
                sample_rate=[1, None, 1, 1, None, None],
                confidence=[any_confidence, None, any_confidence, any_confidence, None, None],
            )
            assert untransformed["values"] == build_expected_timeseries(
                self.start,
                15_000,
                [2, 0, 6, 4, 0, 0],
                sample_count=[2, 0, 6, 4, 0, 0],
                sample_rate=[1, None, 1, 1, None, None],
                confidence=[any_confidence, None, any_confidence, any_confidence, None, None],
            )
            assert (
                transformed["meta"]
                == untransformed["meta"]
                == {
                    "dataScanned": "full",
                    "valueType": "integer",
                    "valueUnit": None,
                    "interval": 15_000,
                }
            )

    def test_transformations_use_original_axis_indices(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start, interval_seconds=15)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "15s",
                "yAxis": ["equation|count() * 2", "count()", "count()"],
                "project": self.project.id,
                "dataset": "spans",
                "transformations[0]": ["fill(locf)"],
                "transformations[1]": ["fill(linear)"],
                "transformations[2]": ["smooth(sma,2)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 200, response.content
        equation, linear, smoothed = response.data["timeSeries"]
        assert equation["yAxis"] == "equation|count() * 2"
        assert linear["yAxis"] == smoothed["yAxis"] == "count()"
        assert equation["values"] == build_expected_timeseries(
            self.start, 15_000, [4, 4, 12, 8, 8, 8], ignore_accuracy=True
        )
        assert linear["values"] == build_expected_timeseries(
            self.start, 15_000, [2, 4, 6, 4, None, None], ignore_accuracy=True
        )
        assert smoothed["values"] == build_expected_timeseries(
            self.start, 15_000, [2, None, 6, 5, None, None], ignore_accuracy=True
        )

    def test_transformations_smooth_top_events_and_other_independently(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        self._store_spans_in_buckets(
            [10, 1, 0, 0, 0, 0], self.start, description="foo", interval_seconds=15
        )
        self._store_spans_in_buckets(
            [0, 0, 0, 8, 4, 0], self.start, description="bar", interval_seconds=15
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "15s",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "groupBy": ["span.description", "count()"],
                "orderby": "-count()",
                "topEvents": 1,
                "excludeOther": 0,
                "transformations[0]": ["smooth(sma,2)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 200, response.content
        selected, other = response.data["timeSeries"]
        assert selected["groupBy"] == [{"key": "span.description", "value": "bar"}]
        assert selected["meta"]["isOther"] is False
        assert selected["values"] == build_expected_timeseries(
            self.start,
            15_000,
            [None, None, None, 8, 6, None],
            sample_count=[0, 0, 0, 8, 4, 0],
            sample_rate=[None, None, None, 1, 1, None],
            confidence=[None, None, None, any_confidence, any_confidence, None],
        )
        assert other["groupBy"] is None
        assert other["meta"]["isOther"] is True
        assert other["values"] == build_expected_timeseries(
            self.start,
            15_000,
            [10, 5.5, None, None, None, None],
            sample_count=[10, 1, 0, 0, 0, 0],
            sample_rate=[1, 1, None, None, None, None],
            confidence=[any_confidence, any_confidence, None, None, None, None],
        )

    def test_transformations_apply_to_comparison_period_independently(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start, interval_seconds=15)
        self._store_spans_in_buckets([0, 8, 0, 2, 0, 0], self.two_days_ago, interval_seconds=15)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "15s",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "comparisonDelta": 24 * 60 * 60,
                "transformations[0]": ["fill(locf)", "smooth(sma,2)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 200, response.content
        (timeseries,) = response.data["timeSeries"]
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            15_000,
            [2, 2, 4, 5, 4, 4],
            [None, 8, 8, 5, 2, 2],
            sample_count=[2, 0, 6, 4, 0, 0],
            sample_rate=[1, None, 1, 1, None, None],
            confidence=[any_confidence, None, any_confidence, any_confidence, None, None],
        )

    def test_transformations_comparison_requires_one_axis(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "15s",
                "yAxis": ["count()", "count()"],
                "project": self.project.id,
                "dataset": "spans",
                "comparisonDelta": 24 * 60 * 60,
                "transformations[0]": ["fill(locf)"],
                "transformations[1]": ["fill(zero)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Only one column can be selected for comparison queries"}

    def test_transformations_preserve_observed_zero(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        self.store_spans(
            [
                self.create_span(start_ts=self.start, duration=0),
                self.create_span(start_ts=self.start + timedelta(seconds=30), duration=6),
            ]
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "15s",
                "yAxis": "avg(span.duration)",
                "project": self.project.id,
                "dataset": "spans",
                "transformations[0]": ["fill(locf)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 200, response.content
        (timeseries,) = response.data["timeSeries"]
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            15_000,
            [0, 0, 6, 6, 6, 6],
            sample_count=[1, 0, 1, 0, 0, 0],
            sample_rate=[1, None, 1, None, None, None],
            confidence=[any_confidence, None, any_confidence, None, None, None],
        )

    def test_transformations_empty_comparison(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start, interval_seconds=15)

        for transformation, expected, comparison in [
            ("fill(locf)", [2, 2, 6, 4, 4, 4], [None, None, None, None, None, None]),
            ("fill(zero)", [2, 0, 6, 4, 0, 0], [0, 0, 0, 0, 0, 0]),
        ]:
            response = self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "15s",
                    "yAxis": "count()",
                    "project": self.project.id,
                    "dataset": "spans",
                    "comparisonDelta": 24 * 60 * 60,
                    "transformations[0]": [transformation],
                },
                features={"organizations:explore-interpolation-and-smoothing": True},
            )

            assert response.status_code == 200, response.content
            (timeseries,) = response.data["timeSeries"]
            assert timeseries["values"] == build_expected_timeseries(
                self.start,
                15_000,
                expected,
                comparison,
                sample_count=[2, 0, 6, 4, 0, 0],
                sample_rate=[1, None, 1, 1, None, None],
                confidence=[any_confidence, None, any_confidence, any_confidence, None, None],
            )

    def test_transformations_empty_primary(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        for transformation, expected in [
            ("fill(locf)", [None, None, None, None, None, None, None]),
            ("fill(zero)", [0, 0, 0, 0, 0, 0, 0]),
        ]:
            response = self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "15s",
                    "yAxis": "count()",
                    "project": self.project.id,
                    "dataset": "spans",
                    "transformations[0]": [transformation],
                },
                features={"organizations:explore-interpolation-and-smoothing": True},
            )

            assert response.status_code == 200, response.content
            (timeseries,) = response.data["timeSeries"]
            assert timeseries["values"] == build_expected_timeseries(
                self.start,
                15_000,
                expected,
            )

    def test_transformations_smooth_before_rebucketing(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        self.store_spans(
            [
                self.create_span(
                    start_ts=self.start + timedelta(seconds=15 * bucket), duration=duration
                )
                for bucket, duration in enumerate([0, 20, 40, 60, 100, 120, 140, 160])
            ]
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "60s",
                "yAxis": ["avg(span.duration)", "avg(span.duration)", "count()"],
                "project": self.project.id,
                "dataset": "spans",
                "transformations[1]": ["smooth(sma,2)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 200, response.content
        average, smoothed, count = response.data["timeSeries"]
        for timeseries, expected in [
            (average, [30, 130]),
            (smoothed, [22.5, 117.5]),
            (count, [4, 4]),
        ]:
            assert timeseries["values"] == build_expected_timeseries(
                self.start,
                60_000,
                expected,
                sample_count=[4, 4],
                sample_rate=[1, 1],
                confidence=[any_confidence, any_confidence],
            )
            assert timeseries["meta"]["interval"] == 60_000

    def test_transformations_rebuild_rate_formulas_at_source_interval(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        self._store_spans_in_buckets([1, 3, 5, 7, 2, 4, 6, 8], self.start, interval_seconds=15)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "60s",
                "yAxis": ["eps()", "eps()", "equation|eps() * 2"],
                "project": self.project.id,
                "dataset": "spans",
                "transformations[1]": ["smooth(sma,2)"],
                "transformations[2]": ["smooth(sma,2)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 200, response.content
        rate, smoothed, equation = response.data["timeSeries"]
        for timeseries, expected in [
            (rate, [0.26666666666666666, 0.3333333333333333]),
            (smoothed, [0.21666666666666667, 0.325]),
            (equation, [0.43333333333333335, 0.65]),
        ]:
            assert [point["value"] for point in timeseries["values"]] == pytest.approx(expected)
            assert timeseries["meta"]["interval"] == 60_000

    def test_transformations_fill_before_rebucketing(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        self.store_spans(
            [
                self.create_span(start_ts=self.start, duration=10),
                self.create_span(start_ts=self.start + timedelta(seconds=45), duration=40),
                self.create_span(start_ts=self.start + timedelta(seconds=105), duration=100),
            ]
        )

        for transformation, expected in [
            ("fill(locf)", [17.5, 55]),
            ("fill(linear)", [25, 77.5]),
        ]:
            response = self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "60s",
                    "yAxis": "avg(span.duration)",
                    "project": self.project.id,
                    "dataset": "spans",
                    "transformations[0]": [transformation],
                },
                features={"organizations:explore-interpolation-and-smoothing": True},
            )

            assert response.status_code == 200, response.content
            (timeseries,) = response.data["timeSeries"]
            assert timeseries["values"] == build_expected_timeseries(
                self.start,
                60_000,
                expected,
                sample_count=[2, 1],
                sample_rate=[1, 1],
                confidence=[any_confidence, any_confidence],
            )
            assert timeseries["meta"]["interval"] == 60_000

    def test_transformations_rebucket_top_events_and_other_independently(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        self._store_spans_in_buckets([10, 1, 0, 0, 0, 0, 0, 0], self.start, "foo", 15)
        self._store_spans_in_buckets([0, 0, 0, 8, 4, 0, 0, 0], self.start, "bar", 15)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "60s",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "groupBy": ["span.description", "count()"],
                "orderby": "-count()",
                "topEvents": 1,
                "excludeOther": 0,
                "transformations[0]": ["smooth(sma,2)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 200, response.content
        selected, other = response.data["timeSeries"]
        assert selected["groupBy"] == [{"key": "span.description", "value": "bar"}]
        assert selected["meta"]["isOther"] is False
        assert selected["values"] == build_expected_timeseries(
            self.start,
            60_000,
            [8, 6],
            sample_count=[8, 4],
            sample_rate=[1, 1],
            confidence=[any_confidence, any_confidence],
        )
        assert other["groupBy"] is None
        assert other["meta"]["isOther"] is True
        assert other["values"] == build_expected_timeseries(
            self.start,
            60_000,
            [7.75, None],
            sample_count=[11, 0],
            sample_rate=[1, None],
            confidence=[any_confidence, None],
        )

    def test_transformations_rebucket_comparison_independently(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        self.store_spans(
            [
                self.create_span(start_ts=start + timedelta(seconds=15 * bucket), duration=duration)
                for start, durations in [
                    (self.start, [0, 20, 40, 60, 100, 120, 140, 160]),
                    (self.two_days_ago, [10, 30, 50, 70, 110, 130, 150, 170]),
                ]
                for bucket, duration in enumerate(durations)
            ]
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "60s",
                "yAxis": "avg(span.duration)",
                "project": self.project.id,
                "dataset": "spans",
                "comparisonDelta": 24 * 60 * 60,
                "transformations[0]": ["smooth(sma,2)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": True},
        )

        assert response.status_code == 200, response.content
        (timeseries,) = response.data["timeSeries"]
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            60_000,
            [22.5, 117.5],
            [32.5, 127.5],
            sample_count=[4, 4],
            sample_rate=[1, 1],
            confidence=[any_confidence, any_confidence],
        )
        assert timeseries["meta"]["interval"] == 60_000

    def test_transformations_ignored_when_feature_disabled(self) -> None:
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "transformations[0]": ["fill(locf)", "smooth(sma,2)"],
            },
            features={"organizations:explore-interpolation-and-smoothing": False},
        )

        assert response.status_code == 200, response.content
        (timeseries,) = response.data["timeSeries"]
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            [2, 0, 6, 4, 0, 0],
            sample_count=[2, 0, 6, 4, 0, 0],
            sample_rate=[1, None, 1, 1, None, None],
            confidence=[any_confidence, None, any_confidence, any_confidence, None, None],
        )
