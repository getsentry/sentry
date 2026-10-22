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


def build_expected_transformed_timeseries(
    *args,
    filled=None,
    smoothed=None,
    comparison_filled=None,
    comparison_smoothed=None,
    **kwargs,
):
    expected = build_expected_timeseries(*args, **kwargs)
    for index, point in enumerate(expected):
        point["filled"] = filled[index] if filled is not None else False
        point["smoothed"] = smoothed[index] if smoothed is not None else False
        if "comparisonValue" in point:
            point["comparisonFilled"] = (
                comparison_filled[index] if comparison_filled is not None else False
            )
            point["comparisonSmoothed"] = (
                comparison_smoothed[index] if comparison_smoothed is not None else False
            )
    return expected


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

    def _do_request(self, data, features=None):
        with self.feature(
            {
                "organizations:discover-basic": True,
                **self.features,
                "organizations:explore-interpolation-and-smoothing": True,
                **(features or {}),
            }
        ):
            return self.client_get(
                data={
                    "start": self.start,
                    "end": self.end,
                    "project": self.project.id,
                    "dataset": "spans",
                    **data,
                },
                url=self.url,
            )

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
            (
                ["smooth(ema,3)"],
                [2, None, 4, 4, None, None],
                None,
                [True, False, True, True, False, False],
            ),
            (
                ["fill(locf)", "smooth(sma,2)"],
                [2, 2, 4, 5, 4, 4],
                [False, True, False, False, True, True],
                [True, True, True, True, True, True],
            ),
            (
                ["smooth(sma,2)", "fill(locf)"],
                [2, 2, 6, 5, 5, 5],
                [False, True, False, False, True, True],
                [True, False, True, True, False, False],
            ),
        ]
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start, interval_seconds=15)
        for transformations, expected, filled, smoothed in cases:
            response = self._do_request(
                data={
                    "interval": "15s",
                    "yAxis": ["count()", "count()"],
                    "transformations[0]": transformations,
                },
            )

            assert response.status_code == 200, response.content
            transformed, untransformed = response.data["timeSeries"]
            assert transformed["yAxis"] == untransformed["yAxis"] == "count()"
            assert transformed["values"] == build_expected_transformed_timeseries(
                self.start,
                15_000,
                expected,
                filled=filled,
                smoothed=smoothed,
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
                "interval": "15s",
                "yAxis": ["equation|count() * 2", "count()", "count()"],
                "transformations[0]": ["fill(locf)"],
                "transformations[1]": ["fill(linear)"],
                "transformations[2]": ["smooth(sma,2)"],
            },
        )

        assert response.status_code == 200, response.content
        equation, linear, smoothed = response.data["timeSeries"]
        assert equation["yAxis"] == "equation|count() * 2"
        assert linear["yAxis"] == smoothed["yAxis"] == "count()"
        assert equation["values"] == build_expected_transformed_timeseries(
            self.start,
            15_000,
            [4, 4, 12, 8, 8, 8],
            filled=[False, True, False, False, True, True],
            ignore_accuracy=True,
        )
        assert linear["values"] == build_expected_transformed_timeseries(
            self.start,
            15_000,
            [2, 4, 6, 4, None, None],
            filled=[False, True, False, False, False, False],
            ignore_accuracy=True,
        )
        assert smoothed["values"] == build_expected_transformed_timeseries(
            self.start,
            15_000,
            [2, None, 6, 5, None, None],
            smoothed=[True, False, True, True, False, False],
            ignore_accuracy=True,
        )

    def test_transformations_smooth_top_events_and_other_independently(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        self._store_spans_in_buckets([10, 1, 0, 0, 0, 0, 0, 0], self.start, "foo", 15)
        self._store_spans_in_buckets([0, 0, 0, 8, 4, 0, 0, 0], self.start, "bar", 15)

        cases: list[tuple[int, list[float | None], list[float | None], list[int], list[int]]] = [
            (
                15,
                [None, None, None, 8, 6, None, None, None],
                [10, 5.5, None, None, None, None, None, None],
                [0, 0, 0, 8, 4, 0, 0, 0],
                [10, 1, 0, 0, 0, 0, 0, 0],
            ),
            (60, [8, 6], [15.5, None], [8, 4], [11, 0]),
        ]
        for interval, selected_values, other_values, selected_counts, other_counts in cases:
            response = self._do_request(
                data={
                    "interval": f"{interval}s",
                    "yAxis": "count()",
                    "groupBy": ["span.description", "count()"],
                    "orderby": "-count()",
                    "topEvents": 1,
                    "excludeOther": 0,
                    "transformations[0]": ["smooth(sma,2)"],
                },
            )

            assert response.status_code == 200, response.content
            selected, other = response.data["timeSeries"]
            assert selected["groupBy"] == [{"key": "span.description", "value": "bar"}]
            assert selected["meta"]["isOther"] is False
            assert other["groupBy"] is None
            assert other["meta"]["isOther"] is True
            for timeseries, expected, sample_counts in [
                (selected, selected_values, selected_counts),
                (other, other_values, other_counts),
            ]:
                assert timeseries["meta"]["interval"] == interval * 1000
                assert timeseries["values"] == build_expected_transformed_timeseries(
                    self.start,
                    interval * 1000,
                    expected,
                    smoothed=[value is not None for value in expected],
                    sample_count=sample_counts,
                    sample_rate=[1 if count else None for count in sample_counts],
                    confidence=[any_confidence if count else None for count in sample_counts],
                )

    def test_transformations_apply_to_comparison_period_independently(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start, interval_seconds=15)
        self._store_spans_in_buckets([0, 8, 0, 2, 0, 0], self.two_days_ago, interval_seconds=15)

        response = self._do_request(
            data={
                "interval": "15s",
                "yAxis": "count()",
                "comparisonDelta": 24 * 60 * 60,
                "transformations[0]": ["fill(locf)", "smooth(sma,2)"],
            },
        )

        assert response.status_code == 200, response.content
        (timeseries,) = response.data["timeSeries"]
        assert timeseries["values"] == build_expected_transformed_timeseries(
            self.start,
            15_000,
            [2, 2, 4, 5, 4, 4],
            [None, 8, 8, 5, 2, 2],
            filled=[False, True, False, False, True, True],
            smoothed=[True, True, True, True, True, True],
            comparison_filled=[False, False, True, False, True, True],
            comparison_smoothed=[False, True, True, True, True, True],
            ignore_accuracy=True,
        )

    def test_transformations_comparison_requires_one_axis(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        response = self._do_request(
            data={
                "interval": "15s",
                "yAxis": ["count()", "count()"],
                "comparisonDelta": 24 * 60 * 60,
                "transformations[0]": ["fill(locf)"],
                "transformations[1]": ["fill(zero)"],
            },
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
                "interval": "15s",
                "yAxis": "avg(span.duration)",
                "transformations[0]": ["fill(locf)"],
            },
        )

        assert response.status_code == 200, response.content
        (timeseries,) = response.data["timeSeries"]
        assert timeseries["values"] == build_expected_transformed_timeseries(
            self.start,
            15_000,
            [0, 0, 6, 6, 6, 6],
            filled=[False, True, False, True, True, True],
            ignore_accuracy=True,
        )

    def test_transformations_empty_comparison(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start, interval_seconds=15)

        for transformation, expected, comparison, comparison_filled in [
            ("fill(locf)", [2, 2, 6, 4, 4, 4], [None] * 6, [False] * 6),
            ("fill(zero)", [2, 0, 6, 4, 0, 0], [0] * 6, [True] * 6),
        ]:
            response = self._do_request(
                data={
                    "interval": "15s",
                    "yAxis": "count()",
                    "comparisonDelta": 24 * 60 * 60,
                    "transformations[0]": [transformation],
                },
            )

            assert response.status_code == 200, response.content
            (timeseries,) = response.data["timeSeries"]
            assert timeseries["values"] == build_expected_transformed_timeseries(
                self.start,
                15_000,
                expected,
                comparison,
                filled=[False, True, False, False, True, True],
                comparison_filled=comparison_filled,
                ignore_accuracy=True,
            )

    def test_transformations_empty_primary(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        for transformation, expected, filled in [
            ("fill(locf)", [None] * 7, [False] * 7),
            ("fill(zero)", [0] * 7, [True] * 7),
        ]:
            response = self._do_request(
                data={
                    "interval": "15s",
                    "yAxis": "count()",
                    "transformations[0]": [transformation],
                },
            )

            assert response.status_code == 200, response.content
            (timeseries,) = response.data["timeSeries"]
            assert timeseries["values"] == build_expected_transformed_timeseries(
                self.start,
                15_000,
                expected,
                filled=filled,
            )

    def test_transformations_preserve_output_bucket_boundaries(self) -> None:
        self.start = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(days=14)
        self.store_spans(
            [
                self.create_span(start_ts=self.start + timedelta(seconds=270), duration=10),
                self.create_span(start_ts=self.start + timedelta(seconds=330), duration=100),
            ]
        )

        response = self._do_request(
            data={
                "interval": "5m",
                "yAxis": ["avg(span.duration)", "avg(span.duration)"],
                "transformations[1]": ["smooth(sma,1)"],
            },
        )

        assert response.status_code == 200, response.content
        original, transformed = response.data["timeSeries"]
        assert [point["value"] for point in original["values"][:2]] == [10, 100]
        assert [point["value"] for point in transformed["values"][:2]] == [10, 100]
        assert transformed["meta"]["interval"] == 300_000

    def test_transformations_rebucket_filled_and_smoothed_flags(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        self.store_spans(
            [
                self.create_span(start_ts=self.start, duration=10),
                self.create_span(start_ts=self.start + timedelta(seconds=45), duration=40),
                self.create_span(start_ts=self.start + timedelta(seconds=105), duration=100),
            ]
        )

        response = self._do_request(
            data={
                "interval": "60s",
                "yAxis": "avg(span.duration)",
                "transformations[0]": ["fill(locf)", "smooth(sma,1)"],
            },
        )

        assert response.status_code == 200, response.content
        (timeseries,) = response.data["timeSeries"]
        assert timeseries["values"] == build_expected_transformed_timeseries(
            self.start,
            60_000,
            [17.5, 55],
            filled=[True, True],
            smoothed=[True, True],
            ignore_accuracy=True,
        )

    def test_transformations_empty_primary_with_comparison_flags(self) -> None:
        self.end = self.start + timedelta(seconds=90)
        self._store_spans_in_buckets([0, 2, 0, 0, 0, 0], self.two_days_ago, interval_seconds=15)

        response = self._do_request(
            data={
                "interval": "15s",
                "yAxis": "count()",
                "comparisonDelta": 24 * 60 * 60,
                "transformations[0]": ["fill(locf)"],
            },
        )

        assert response.status_code == 200, response.content
        (timeseries,) = response.data["timeSeries"]
        expected = build_expected_transformed_timeseries(self.start, 15_000, [None] * 7)
        for point, comparison, filled in zip(
            expected, [None, 2, 2, 2, 2, 2], [False, False, True, True, True, True]
        ):
            point.update(
                comparisonValue=comparison, comparisonFilled=filled, comparisonSmoothed=False
            )
        assert timeseries["values"] == expected

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
                "interval": "60s",
                "yAxis": ["avg(span.duration)", "avg(span.duration)", "count()"],
                "transformations[1]": ["smooth(sma,2)"],
            },
        )

        assert response.status_code == 200, response.content
        average, smoothed, count = response.data["timeSeries"]
        for timeseries, expected in [
            (average, [30, 130]),
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
        assert smoothed["values"] == build_expected_transformed_timeseries(
            self.start,
            60_000,
            [22.5, 117.5],
            smoothed=[True, True],
            sample_count=[4, 4],
            sample_rate=[1, 1],
            confidence=[any_confidence, any_confidence],
        )

    def test_transformations_rebuild_rate_formulas_at_source_interval(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        self._store_spans_in_buckets([1, 3, 5, 7, 2, 4, 6, 8], self.start, interval_seconds=15)

        response = self._do_request(
            data={
                "interval": "60s",
                "yAxis": ["eps()", "eps()", "equation|eps() * 2"],
                "transformations[1]": ["smooth(sma,2)"],
                "transformations[2]": ["smooth(sma,2)"],
            },
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

    def test_transformations_fill_at_output_interval(self) -> None:
        self.end = self.start + timedelta(minutes=3)
        self.store_spans(
            [
                self.create_span(start_ts=self.start, duration=10),
                self.create_span(start_ts=self.start + timedelta(seconds=45), duration=40),
                self.create_span(start_ts=self.start + timedelta(seconds=165), duration=100),
            ]
        )

        for transformation, smoothing, expected in [
            ("fill(locf)", {}, [25, 25, 100]),
            ("fill(linear)", {}, [25, 62.5, 100]),
            ("fill(linear)", {"transformations[1]": ["smooth(sma,1)"]}, [25, 62.5, 100]),
        ]:
            response = self._do_request(
                data={
                    "interval": "60s",
                    "yAxis": ["avg(span.duration)", "avg(span.duration)"],
                    "transformations[0]": [transformation],
                    **smoothing,
                },
            )

            assert response.status_code == 200, response.content
            timeseries = response.data["timeSeries"][0]
            assert timeseries["values"] == build_expected_transformed_timeseries(
                self.start,
                60_000,
                expected,
                filled=[False, True, False],
                ignore_accuracy=True,
            )
            assert timeseries["meta"]["interval"] == 60_000

    def test_transformations_sum_counts_and_sums_when_rebucketing(self) -> None:
        self.end = self.start + timedelta(minutes=2)
        axes = [
            "count(span.duration)",
            "count_if(span.duration,greater,0)",
            "count_op(foo)",
            "count_sample(span.duration)",
            "sum(span.duration)",
            "sum_if(span.duration,span.op,equals,foo)",
            "avg_if(span.duration,span.op,equals,foo)",
            "count_unique(span.op)",
        ]
        self.store_spans(
            [
                self.create_span(
                    {"op": "foo", "sentry_tags": {"op": "foo"}},
                    start_ts=self.start + timedelta(seconds=15 * bucket + offset),
                    duration=10,
                )
                for bucket, count in enumerate([1, 3, 5, 7, 2, 4, 6, 8])
                for offset in range(count)
            ]
        )

        for transformation, expected_counts, expected_sums in [
            ("smooth(sma,1)", [16, 20], [160, 200]),
            ("smooth(sma,2)", [13, 19.5], [130, 195]),
        ]:
            response = self._do_request(
                data={
                    "interval": "60s",
                    "yAxis": axes,
                    **{f"transformations[{index}]": [transformation] for index in range(len(axes))},
                },
            )

            assert response.status_code == 200, response.content
            assert len(response.data["timeSeries"]) == len(axes)
            for timeseries, expected in zip(
                response.data["timeSeries"],
                [expected_counts] * 4 + [expected_sums] * 2 + [[10, 10], [1, 1]],
            ):
                assert [point["value"] for point in timeseries["values"]] == expected, timeseries[
                    "yAxis"
                ]

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

        for axis, expected, comparison in [
            ("avg(span.duration)", [22.5, 117.5], [32.5, 127.5]),
            ("count()", [4, 4], [4, 4]),
            ("sum(span.duration)", [90, 470], [130, 510]),
        ]:
            response = self._do_request(
                data={
                    "interval": "60s",
                    "yAxis": axis,
                    "comparisonDelta": 24 * 60 * 60,
                    "transformations[0]": ["smooth(sma,2)"],
                },
            )

            assert response.status_code == 200, response.content
            (timeseries,) = response.data["timeSeries"]
            assert timeseries["values"] == build_expected_transformed_timeseries(
                self.start,
                60_000,
                expected,
                comparison,
                smoothed=[True, True],
                comparison_smoothed=[True, True],
                ignore_accuracy=True,
            )
            assert timeseries["meta"]["interval"] == 60_000

    def test_transformations_ignored_when_feature_disabled(self) -> None:
        self._store_spans_in_buckets([2, 0, 6, 4, 0, 0], self.start)

        response = self._do_request(
            data={
                "interval": "1h",
                "yAxis": "count()",
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
