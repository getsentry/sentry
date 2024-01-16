import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Sequence, cast
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.metadata.code_locations import get_cache_key_for_code_location
from sentry.sentry_metrics.querying.utils import get_redis_client_for_metrics_meta
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
@freeze_time("2023-11-21T10:30:30.000Z")
class OrganizationDDMEndpointTest(APITestCase, BaseSpansTestCase):
    endpoint = "sentry-api-0-organization-ddm-meta"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.redis_client = get_redis_client_for_metrics_meta()
        self.current_time = timezone.now()

    def _mock_code_location(
        self,
        filename: str,
        pre_context: Optional[List[str]] = None,
        post_context: Optional[List[str]] = None,
    ) -> str:
        code_location = {
            "function": "foo",
            "module": "bar",
            "filename": filename,
            "abs_path": f"/usr/src/foo/{filename}",
            "lineNo": 10,
            "context_line": "context",
        }

        if pre_context is not None:
            code_location["pre_context"] = pre_context
        if post_context is not None:
            code_location["post_context"] = post_context

        return json.dumps(code_location)

    def _store_code_location(
        self, organization_id: int, project_id: int, metric_mri: str, timestamp: int, value: str
    ):
        cache_key = get_cache_key_for_code_location(
            organization_id, project_id, metric_mri, timestamp
        )
        self.redis_client.sadd(cache_key, value)

    def _round_to_day(self, time: datetime) -> int:
        return int(time.timestamp() / 86400) * 86400

    def _store_code_locations(
        self,
        organization: Organization,
        projects: Sequence[Project],
        metric_mris: Sequence[str],
        days: int,
    ):
        timestamps = [
            self._round_to_day(self.current_time - timedelta(days=day)) for day in range(0, days)
        ]
        for project in projects:
            for metric_mri in metric_mris:
                for timestamp in timestamps:
                    self._store_code_location(
                        organization.id,
                        project.id,
                        metric_mri,
                        timestamp,
                        self._mock_code_location("script.py"),
                    )
                    self._store_code_location(
                        organization.id,
                        project.id,
                        metric_mri,
                        timestamp,
                        self._mock_code_location("main.py"),
                    )

    def test_get_locations_with_stats_period(self):
        projects = [self.create_project(name="project_1")]
        mris = [
            "d:custom/sentry.process_profile.track_outcome@second",
        ]

        # We specify two days, since we are querying a stats period of 1 day, thus from one day to another.
        self._store_code_locations(self.organization, projects, mris, 2)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            statsPeriod="1d",
            codeLocations="true",
        )
        code_locations = response.data["codeLocations"]

        assert len(code_locations) == 2

        assert code_locations[0]["mri"] == mris[0]
        assert code_locations[0]["timestamp"] == self._round_to_day(
            self.current_time - timedelta(days=1)
        )

        assert code_locations[1]["mri"] == mris[0]
        assert code_locations[1]["timestamp"] == self._round_to_day(self.current_time)

        frames = code_locations[0]["frames"]
        assert len(frames) == 2
        for index, filename in enumerate(("main.py", "script.py")):
            assert frames[index]["filename"] == filename

        frames = code_locations[0]["frames"]
        assert len(frames) == 2
        for index, filename in enumerate(("main.py", "script.py")):
            assert frames[index]["filename"] == filename

    def test_get_locations_with_start_and_end(self):
        projects = [self.create_project(name="project_1")]
        mris = [
            "d:custom/sentry.process_profile.track_outcome@second",
        ]

        # We specify two days, since we are querying a stats period of 1 day, thus from one day to another.
        self._store_code_locations(self.organization, projects, mris, 2)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            # We use an interval of 1 day but shifted by 1 day in the past.
            start=(self.current_time - timedelta(days=2)).isoformat(),
            end=(self.current_time - timedelta(days=1)).isoformat(),
            codeLocations="true",
        )
        code_locations = response.data["codeLocations"]

        assert len(code_locations) == 1

        assert code_locations[0]["mri"] == mris[0]
        assert code_locations[0]["timestamp"] == self._round_to_day(
            self.current_time - timedelta(days=1)
        )

        frames = code_locations[0]["frames"]
        assert len(frames) == 2
        for index, filename in enumerate(("main.py", "script.py")):
            assert frames[index]["filename"] == filename

    def test_get_locations_with_start_and_end_and_no_data(self):
        projects = [self.create_project(name="project_1")]
        mris = ["d:custom/sentry.process_profile.track_outcome@second"]

        # We specify two days, since we are querying a stats period of 1 day, thus from one day to another.
        self._store_code_locations(self.organization, projects, mris, 2)

        response = self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            # We use an interval outside which we have no data.
            start=(self.current_time - timedelta(days=3)).isoformat(),
            end=(self.current_time - timedelta(days=2)).isoformat(),
            codeLocations="true",
        )
        codeLocations = response.data["codeLocations"]

        assert len(codeLocations) == 0

    @patch(
        "sentry.sentry_metrics.querying.metadata.code_locations.CodeLocationsFetcher._get_code_locations"
    )
    @patch(
        "sentry.sentry_metrics.querying.metadata.code_locations.CodeLocationsFetcher.BATCH_SIZE", 10
    )
    def test_get_locations_batching(self, get_code_locations_mock):
        get_code_locations_mock.return_value = []

        projects = [self.create_project(name="project_1")]
        mris = ["d:custom/sentry.process_profile.track_outcome@second"]

        self.get_success_response(
            self.organization.slug,
            metric=mris,
            project=[project.id for project in projects],
            statsPeriod="90d",
            codeLocations="true",
        )

        # With a window of 90 days, it means that we are actually requesting 91 days, thus we have 10 batches of 10
        # elements each.
        assert len(get_code_locations_mock.mock_calls) == 10

    def test_get_locations_with_incomplete_location(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self._store_code_location(
            self.organization.id,
            project.id,
            mri,
            self._round_to_day(self.current_time),
            '{"lineno": 10}',
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="1d",
            codeLocations="true",
        )
        code_locations = response.data["codeLocations"]

        assert len(code_locations) == 1

        assert code_locations[0]["mri"] == mri
        assert code_locations[0]["timestamp"] == self._round_to_day(self.current_time)

        frames = code_locations[0]["frames"]
        assert len(frames) == 1
        assert frames[0]["lineNo"] == 10
        # We check that all the remaining elements are `None` or empty.
        del frames[0]["lineNo"]
        for value in frames[0].values():
            assert value is None or value == []

    def test_get_locations_with_corrupted_location(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self._store_code_location(
            self.organization.id,
            project.id,
            mri,
            self._round_to_day(self.current_time),
            '}"invalid": "json"{',
        )

        self.get_error_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="1d",
            status_code=500,
            codeLocations="true",
        )

    def test_get_pre_post_context(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self._store_code_location(
            self.organization.id,
            project.id,
            mri,
            self._round_to_day(self.current_time),
            self._mock_code_location("script.py", ["pre"], ["post"]),
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="1d",
            codeLocations="true",
        )

        code_locations = response.data["codeLocations"]

        frame = code_locations[0]["frames"][0]
        assert frame["preContext"] == ["pre"]
        assert frame["postContext"] == ["post"]

    def test_get_no_pre_post_context(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self._store_code_location(
            self.organization.id,
            project.id,
            mri,
            self._round_to_day(self.current_time),
            self._mock_code_location("script.py"),
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="1d",
            codeLocations="true",
        )

        code_locations = response.data["codeLocations"]

        frame = code_locations[0]["frames"][0]
        assert frame["preContext"] == []
        assert frame["postContext"] == []

    @patch(
        "sentry.sentry_metrics.querying.metadata.code_locations.CodeLocationsFetcher.MAXIMUM_KEYS",
        50,
    )
    def test_get_locations_with_too_many_combinations(self):
        project = self.create_project(name="project_1")
        mri = "d:custom/sentry.process_profile.track_outcome@second"

        self.get_error_response(
            self.organization.slug,
            metric=[mri],
            project=[project.id],
            statsPeriod="90d",
            status_code=500,
            codeLocations="true",
        )

    def test_get_metric_spans(self):
        mri = "g:custom/page_load@millisecond"

        transaction_id = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        span_id = "98230207e6e4a6ad"
        self.store_span(
            project_id=self.project.id,
            timestamp=before_now(minutes=5),
            trace_id=trace_id,
            transaction_id=transaction_id,
            span_id=span_id,
            store_transaction_and_span=True,
            store_metrics_summary={
                mri: [
                    {
                        "min": 10.0,
                        "max": 100.0,
                        "sum": 110.0,
                        "count": 2,
                        "tags": {
                            "transaction": "/hello",
                        },
                    }
                ]
            },
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=["g:custom/page_load@millisecond"],
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )

        metric_spans = response.data["metricSpans"]
        assert len(metric_spans) == 1
        assert metric_spans[0]["transactionId"] == transaction_id
        assert metric_spans[0]["duration"] == 10
        assert metric_spans[0]["spansNumber"] == 1

    def test_get_metric_spans_with_bounds(self):
        mri = "g:custom/page_load@millisecond"

        transaction_id_1 = uuid.uuid4().hex
        span_id_1 = "98230207e6e4a6ad"
        transaction_id_2 = uuid.uuid4().hex
        span_id_2 = "10220507e6f4e6ad"

        for i, (transaction_id, span_id, min_value, max_value) in enumerate(
            (
                (transaction_id_1, span_id_1, 10.0, 100.0),
                (transaction_id_2, span_id_2, 120.0, 200.0),
            )
        ):
            self.store_span(
                project_id=self.project.id,
                timestamp=before_now(minutes=5 + i),
                transaction_id=transaction_id,
                span_id=span_id,
                store_transaction_and_span=True,
                store_metrics_summary={
                    mri: [
                        {
                            "min": min_value,
                            "max": max_value,
                            "sum": 110.0,
                            "count": 2,
                        }
                    ]
                },
            )

        for min_val, max_val, expected_transaction_ids in (
            (10.0, 100.0, [transaction_id_1]),
            (100.0, 200.0, [transaction_id_2]),
            (10.0, 200.0, [transaction_id_1, transaction_id_2]),
            (10.0, 20.0, []),
            (10.0, None, [transaction_id_1, transaction_id_2]),
            (None, 200.0, [transaction_id_1, transaction_id_2]),
            (None, None, [transaction_id_1, transaction_id_2]),
        ):
            extra_params = {}
            if min_val:
                extra_params["min"] = min_val
            if max_val:
                extra_params["max"] = max_val

            response = self.get_success_response(
                self.organization.slug,
                metric=["g:custom/page_load@millisecond"],
                project=[self.project.id],
                statsPeriod="1d",
                metricSpans="true",
                **extra_params,
            )

            metric_spans = response.data["metricSpans"]
            assert len(metric_spans) == len(cast(Sequence[str], expected_transaction_ids))
            for i, expected_span_id in enumerate(cast(Sequence[str], expected_transaction_ids)):
                assert metric_spans[i]["transactionId"] == expected_span_id

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_query(self):
        mri = "g:custom/page_load@millisecond"

        span_id_1 = "98230207e6e4a6ad"
        self.store_span(
            project_id=self.project.id,
            timestamp=before_now(minutes=5),
            span_id=span_id_1,
            store_metrics_summary={
                mri: [
                    {
                        "min": 10.0,
                        "max": 100.0,
                        "sum": 110.0,
                        "count": 2,
                        "tags": {
                            "transaction": "/hello",
                        },
                    }
                ]
            },
        )

        span_id_2 = "10220507e6f4e6ad"
        self.store_span(
            project_id=self.project.id,
            timestamp=before_now(minutes=10),
            span_id=span_id_2,
            store_metrics_summary={
                mri: [
                    {
                        "min": 10.0,
                        "max": 100.0,
                        "sum": 110.0,
                        "count": 2,
                        "tags": {
                            "transaction": "/world",
                        },
                    }
                ]
            },
        )

        for query, expected_span_ids in (
            ("transaction:/hello", [span_id_1]),
            ("transaction:/world", [span_id_2]),
            ("transaction:[/hello,/world]", [span_id_1, span_id_2]),
            ("!transaction:[/hello,/world]", []),
            ("(transaction:/hello AND transaction:/world)", []),
        ):
            response = self.get_success_response(
                self.organization.slug,
                metric=["g:custom/page_load@millisecond"],
                project=[self.project.id],
                statsPeriod="1d",
                metricSpans="true",
                query=query,
            )

            metric_spans = response.data["metricSpans"]
            assert len(metric_spans) == len(cast(Sequence[str], expected_span_ids))
            for i, expected_span_id in enumerate(cast(Sequence[str], expected_span_ids)):
                assert metric_spans[i]["spanId"] == expected_span_id

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_multiple_spans(self):
        mri = "g:custom/page_load@millisecond"

        data = [("98230207e6e4a6ad", "/hello"), ("10220507e6f4e6ad", "/world")]
        for index, (span_id, transaction) in enumerate(data):
            self.store_span(
                project_id=self.project.id,
                timestamp=before_now(minutes=5 - index),
                span_id=span_id,
                store_metrics_summary={
                    mri: [
                        {
                            "min": 10.0,
                            "max": 100.0,
                            "sum": 110.0,
                            "count": 2,
                            "tags": {
                                "transaction": transaction,
                            },
                        }
                    ]
                },
            )

        response = self.get_success_response(
            self.organization.slug,
            metric=["g:custom/page_load@millisecond"],
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )

        metric_spans = response.data["metricSpans"]
        assert len(metric_spans) == 2
        # We expect the first span to be the newest.
        assert metric_spans[0]["spanId"] == data[1][0]
        assert metric_spans[1]["spanId"] == data[0][0]

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    @patch("sentry.sentry_metrics.querying.metadata.metric_spans.MAX_NUMBER_OF_SPANS", 1)
    def test_get_metric_spans_with_limit_exceeded(self):
        mri = "g:custom/page_load@millisecond"

        span_id_1 = "10220507e6f4e6ad"
        # We store an additional span just to show that we return only the spans matching the summary of a metric.
        self.store_span(
            project_id=self.project.id,
            timestamp=before_now(minutes=5),
            span_id=span_id_1,
        )

        span_id_2 = "98230207e6e4a6ad"
        for transaction, store_only_summary in (("/hello", False), ("/world", True)):
            self.store_span(
                project_id=self.project.id,
                timestamp=before_now(minutes=5),
                span_id=span_id_2,
                store_metrics_summary={
                    mri: [
                        {
                            "min": 10.0,
                            "max": 100.0,
                            "sum": 110.0,
                            "count": 2,
                            "tags": {
                                "transaction": transaction,
                            },
                        }
                    ]
                },
                store_only_summary=store_only_summary,
            )

        response = self.get_success_response(
            self.organization.slug,
            metric=["g:custom/page_load@millisecond"],
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )

        metric_spans = response.data["metricSpans"]
        # We are storing two summaries on the same span and two different spans. We expect that with a limit of 1,
        # we get 1 unique span back.
        assert len(metric_spans) == 1
        assert metric_spans[0]["spanId"] == span_id_2

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_invalid_bounds(self):
        self.get_error_response(
            self.organization.slug,
            metric=["g:custom/page_load@millisecond"],
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
            min="100.0",
            max="10.0",
            status_code=500,
        )

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_invalid_query(self):
        self.get_error_response(
            self.organization.slug,
            metric=["g:custom/page_load@millisecond"],
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
            query="device:something XOR device:something_else",
            status_code=500,
        )

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_transaction_duration_with_filters(self):
        mri = TransactionMRI.DURATION.value

        data = [
            ("98230207e6e4a6ad", "/api/users", "iPhone"),
            ("96b41c8d77b591ab", "/api/users", "OnePlus"),
        ]
        for index, (span_id, transaction, device) in enumerate(data):
            self.store_span(
                project_id=self.project.id,
                timestamp=before_now(minutes=5 - index),
                span_id=span_id,
                is_segment=True,
                duration_ms=100,
                transaction=transaction,
                tags={"device": device},
            )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            query="transaction:/api/users AND device:OnePlus",
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )
        metric_spans = response.data["metricSpans"]
        assert len(metric_spans) == 1
        assert metric_spans[0]["spanId"] == data[1][0]
        assert metric_spans[0]["segmentName"] == data[1][1]

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            query="transaction:/api/users AND (device:OnePlus OR device:iPhone)",
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )
        metric_spans = response.data["metricSpans"]
        assert len(metric_spans) == 2
        assert metric_spans[0]["spanId"] == data[1][0]
        assert metric_spans[0]["segmentName"] == data[1][1]
        assert metric_spans[1]["spanId"] == data[0][0]
        assert metric_spans[1]["segmentName"] == data[0][1]

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            query="transaction:/api/users AND device:iPhone AND device:OnePlus",
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )
        metric_spans = response.data["metricSpans"]
        assert len(metric_spans) == 0

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_transaction_duration_with_bounds(self):
        mri = TransactionMRI.DURATION.value

        span_id = "98230207e6e4a6ad"
        transaction = "/api/users"
        self.store_span(
            project_id=self.project.id,
            timestamp=before_now(minutes=5),
            span_id=span_id,
            is_segment=True,
            duration_ms=100,
            transaction=transaction,
        )

        for min_val, max_val, expected_span_ids in (
            (10.0, 100.0, [span_id]),
            (90.0, 150.0, [span_id]),
            (10.0, 50.0, []),
            (None, 90, []),
            (None, 100, [span_id]),
            (110, None, []),
            (100, None, [span_id]),
            (None, None, [span_id]),
        ):
            extra_params = {}
            if min_val:
                extra_params["min"] = min_val
            if max_val:
                extra_params["max"] = max_val

            response = self.get_success_response(
                self.organization.slug,
                metric=[mri],
                project=[self.project.id],
                statsPeriod="1d",
                metricSpans="true",
                **extra_params,
            )

            metric_spans = response.data["metricSpans"]
            assert len(metric_spans) == len(cast(Sequence[str], expected_span_ids))
            for i, expected_span_id in enumerate(cast(Sequence[str], expected_span_ids)):
                assert metric_spans[i]["spanId"] == expected_span_id

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_measurement_with_filters(self):
        lcp_mri = TransactionMRI.MEASUREMENTS_LCP.value
        fcp_mri = TransactionMRI.MEASUREMENTS_FCP.value

        data = [
            (lcp_mri, "lcp", "98230207e6e4a6ad", "/api/users", "iPhone"),
            (lcp_mri, "lcp", "23430217e654a6ad", "/api/events", "Samsung Galaxy"),
            (fcp_mri, "fcp", "96b41c8d77b591ab", "/api/users", "OnePlus"),
            (fcp_mri, "fcp", "16bd1c7d77b591ab", "/api/customers", "iPhone"),
        ]
        for index, (mri, measurement, span_id, transaction, device) in enumerate(data):
            self.store_span(
                project_id=self.project.id,
                timestamp=before_now(minutes=5 - index),
                span_id=span_id,
                is_segment=True,
                transaction=transaction,
                tags={"device": device},
                measurements={measurement: 100},
            )

        response = self.get_success_response(
            self.organization.slug,
            metric=[lcp_mri],
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )
        metric_spans = response.data["metricSpans"]
        assert len(metric_spans) == 2
        assert metric_spans[0]["spanId"] == data[1][2]
        assert metric_spans[0]["segmentName"] == data[1][3]
        assert metric_spans[1]["spanId"] == data[0][2]
        assert metric_spans[1]["segmentName"] == data[0][3]

        response = self.get_success_response(
            self.organization.slug,
            metric=[lcp_mri],
            query="transaction:/api/users",
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )
        metric_spans = response.data["metricSpans"]
        assert len(metric_spans) == 1
        assert metric_spans[0]["spanId"] == data[0][2]
        assert metric_spans[0]["segmentName"] == data[0][3]

        response = self.get_success_response(
            self.organization.slug,
            metric=[fcp_mri],
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
        )
        metric_spans = response.data["metricSpans"]
        assert len(metric_spans) == 2
        assert metric_spans[0]["spanId"] == data[3][2]
        assert metric_spans[0]["segmentName"] == data[3][3]
        assert metric_spans[1]["spanId"] == data[2][2]
        assert metric_spans[1]["segmentName"] == data[2][3]

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_measurement_with_bounds(self):
        mri = TransactionMRI.MEASUREMENTS_APP_START_COLD.value

        span_id = "98230207e6e4a6ad"
        transaction = "/api/users"
        self.store_span(
            project_id=self.project.id,
            timestamp=before_now(minutes=5),
            span_id=span_id,
            is_segment=True,
            transaction=transaction,
            measurements={"app_start_cold": 100},
        )

        for min_val, max_val, expected_span_ids in (
            (10.0, 100.0, [span_id]),
            (90.0, 150.0, [span_id]),
            (10.0, 50.0, []),
            (None, 90, []),
            (None, 100, [span_id]),
            (110, None, []),
            (100, None, [span_id]),
            (None, None, [span_id]),
        ):
            extra_params = {}
            if min_val:
                extra_params["min"] = min_val
            if max_val:
                extra_params["max"] = max_val

            response = self.get_success_response(
                self.organization.slug,
                metric=[mri],
                project=[self.project.id],
                statsPeriod="1d",
                metricSpans="true",
                **extra_params,
            )

            metric_spans = response.data["metricSpans"]
            assert len(metric_spans) == len(cast(Sequence[str], expected_span_ids))
            for i, expected_span_id in enumerate(cast(Sequence[str], expected_span_ids)):
                assert metric_spans[i]["spanId"] == expected_span_id

    @pytest.mark.skip(
        reason="experimenting with new querying that would require this test to be rewritten"
    )
    def test_get_metric_spans_with_measurement_with_zero_edge_case(self):
        mri = TransactionMRI.MEASUREMENTS_FRAMES_FROZEN.value

        self.store_span(
            project_id=self.project.id,
            timestamp=before_now(minutes=5),
            span_id="98230207e6e4a6ad",
            is_segment=True,
        )
        self.store_span(
            project_id=self.project.id,
            timestamp=before_now(minutes=5),
            span_id="16bd1c7d77b591ab",
            is_segment=True,
            measurements={"frames_frozen": 0},
        )

        response = self.get_success_response(
            self.organization.slug,
            metric=[mri],
            project=[self.project.id],
            statsPeriod="1d",
            metricSpans="true",
            min="0",
        )
        metric_spans = response.data["metricSpans"]
        # We expect to only have returned that span with that measurement, even if the value is 0.
        assert len(metric_spans) == 1
