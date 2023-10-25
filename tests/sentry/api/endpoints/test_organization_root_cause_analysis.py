from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data

FEATURES = ["organizations:performance-duration-regression-visible"]

pytestmark = [pytest.mark.sentry_metrics]


@region_silo_test(stable=True)
@freeze_time(MetricsAPIBaseTestCase.MOCK_DATETIME)
class OrganizationRootCauseAnalysisTest(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            "sentry-api-0-organization-events-root-cause-analysis", args=[self.org.slug]
        )
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "foo"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=1,
        )
        self.trace_id = "a" * 32

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME.replace(tzinfo=None)

    def create_transaction(
        self,
        transaction,
        trace_id,
        span_id,
        parent_span_id,
        spans,
        project_id,
        start_timestamp,
        duration,
        transaction_id=None,
    ):
        timestamp = start_timestamp + timedelta(milliseconds=duration)

        data = load_data(
            "transaction",
            trace=trace_id,
            span_id=span_id,
            spans=spans,
            start_timestamp=start_timestamp,
            timestamp=timestamp,
        )
        if transaction_id is not None:
            data["event_id"] = transaction_id
        data["transaction"] = transaction
        data["contexts"]["trace"]["parent_span_id"] = parent_span_id
        return self.store_event(data, project_id=project_id)

    def test_404s_without_feature_flag(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content

    def test_transaction_name_required(self):
        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "project": self.project.id,
                    "breakpoint": (self.now - timedelta(days=1)).isoformat(),
                },
            )

        assert response.status_code == 400, response.content

    def test_project_id_required(self):
        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "foo",
                },
            )

        assert response.status_code == 400, response.content

    def test_breakpoint_required(self):
        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={"transaction": "foo", "project": self.project.id},
            )

        assert response.status_code == 400, response.content

    def test_transaction_must_exist(self):
        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "foo",
                    "project": self.project.id,
                    "breakpoint": self.now - timedelta(days=1),
                    "start": self.now - timedelta(days=3),
                    "end": self.now,
                },
            )

        assert response.status_code == 200, response.content

        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "does not exist",
                    "project": self.project.id,
                    "breakpoint": self.now - timedelta(days=1),
                    "start": self.now - timedelta(days=3),
                    "end": self.now,
                },
            )

        assert response.status_code == 400, response.content

    # TODO: Enable this test when adding a serializer to handle validation
    # def test_breakpoint_must_be_in_the_past(self):
    #     with self.feature(FEATURES):
    #         response = self.client.get(
    #             self.url,
    #             format="json",
    #             data={
    #                 "transaction": "foo",
    #                 "project": self.project.id,
    #                 "breakpoint": (self.now + timedelta(days=1)).isoformat(),
    #             },
    #         )

    #     assert response.status_code == 400, response.content

    def test_returns_change_data_for_regressed_spans(self):
        before_timestamp = self.now - timedelta(days=2)
        before_span = {
            "parent_span_id": "a" * 16,
            "span_id": "e" * 16,
            "start_timestamp": iso_format(before_timestamp),
            "timestamp": iso_format(before_timestamp),
            "op": "django.middleware",
            "description": "middleware span",
            "exclusive_time": 60.0,
        }

        # before
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            spans=[before_span],
            project_id=self.project.id,
            start_timestamp=before_timestamp,
            duration=60,
        )
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="b" * 16,
            parent_span_id="b" * 16,
            spans=[{**before_span, "op": "db", "description": "db span"}],
            project_id=self.project.id,
            start_timestamp=before_timestamp,
            duration=60,
        )

        # after
        after_timestamp = self.now - timedelta(hours=1)
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="c" * 16,
            parent_span_id="d" * 16,
            spans=[
                {
                    "parent_span_id": "e" * 16,
                    "span_id": "f" * 16,
                    "start_timestamp": iso_format(after_timestamp),
                    "timestamp": iso_format(after_timestamp),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 40.0,
                },
                {
                    "parent_span_id": "1" * 16,
                    "span_id": "2" * 16,
                    "start_timestamp": iso_format(after_timestamp),
                    "timestamp": iso_format(after_timestamp),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 600.0,
                },
                {
                    "parent_span_id": "1" * 16,
                    "span_id": "3" * 16,
                    "start_timestamp": iso_format(after_timestamp),
                    "timestamp": iso_format(after_timestamp),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 60.0,
                },
                # This db span shouldn't appear in the results
                # since there are no changes
                {**before_span, "span_id": "5" * 16, "op": "db", "description": "db span"},
            ],
            project_id=self.project.id,
            start_timestamp=after_timestamp,
            duration=600,
        )

        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "foo",
                    "project": self.project.id,
                    "breakpoint": self.now - timedelta(days=1),
                    "start": self.now - timedelta(days=3),
                    "end": self.now,
                },
            )

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "span_op": "django.middleware",
                "span_group": "2b9cbb96dbf59baa",
                "span_description": "middleware span",
                "score": 1.1166666666666667,
                "spm_before": 0.00034722222222222224,
                "spm_after": 0.0020833333333333333,
                "p95_before": 60.0,
                "p95_after": 546.0,
            },
            {
                "p95_after": 60.0,
                "p95_before": 60.0,
                "score": 0.020833333333333336,
                "span_description": "db span",
                "span_group": "5ad8c5a1e8d0e5f7",
                "span_op": "db",
                "spm_after": 0.0006944444444444445,
                "spm_before": 0.00034722222222222224,
            },
        ]

    def test_results_are_limited(self):
        # Before
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            spans=[
                {
                    "parent_span_id": "a" * 16,
                    "span_id": "e" * 16,
                    "start_timestamp": iso_format(self.now - timedelta(days=2)),
                    "timestamp": iso_format(self.now - timedelta(days=2)),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 60.0,
                }
            ],
            project_id=self.project.id,
            start_timestamp=self.now - timedelta(days=2),
            duration=60,
        )

        # After
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            spans=[
                {
                    "parent_span_id": "a" * 16,
                    "span_id": "e" * 16,
                    "start_timestamp": iso_format(self.now - timedelta(hours=1)),
                    "timestamp": iso_format(self.now - timedelta(hours=1)),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 100.0,
                },
                {
                    "parent_span_id": "a" * 16,
                    "span_id": "f" * 16,
                    "start_timestamp": iso_format(self.now - timedelta(hours=1)),
                    "timestamp": iso_format(self.now - timedelta(hours=1)),
                    "op": "db",
                    "description": "db",
                    "exclusive_time": 10000.0,
                },
            ],
            project_id=self.project.id,
            start_timestamp=self.now - timedelta(hours=1),
            duration=10100,
        )

        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "foo",
                    "project": self.project.id,
                    "breakpoint": self.now - timedelta(days=1),
                    "start": self.now - timedelta(days=3),
                    "end": self.now,
                    "per_page": 1,
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data == [
            {
                "span_op": "db",
                "span_group": "d77d5e503ad1439f",
                "score": 6.944444444444445,
                "spm_before": 0.0,
                "spm_after": 0.0006944444444444445,
                "p95_before": 0.0,
                "p95_after": 10000.0,
                "span_description": "db",
            }
        ]

    def test_analysis_leaves_a_buffer_around_breakpoint_to_ignore_mixed_transactions(self):
        breakpoint_timestamp = self.now - timedelta(days=1)
        before_timestamp = breakpoint_timestamp - timedelta(hours=1)
        after_timestamp = breakpoint_timestamp + timedelta(hours=1)

        # Before
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            spans=[
                {
                    "parent_span_id": "a" * 16,
                    "span_id": "e" * 16,
                    "start_timestamp": iso_format(before_timestamp),
                    "timestamp": iso_format(before_timestamp),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 60.0,
                }
            ],
            project_id=self.project.id,
            start_timestamp=before_timestamp,
            duration=60,
        )

        # After
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            spans=[
                {
                    "parent_span_id": "a" * 16,
                    "span_id": "e" * 16,
                    "start_timestamp": iso_format(after_timestamp),
                    "timestamp": iso_format(after_timestamp),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 100.0,
                },
            ],
            project_id=self.project.id,
            start_timestamp=after_timestamp,
            duration=200,
        )

        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "foo",
                    "project": self.project.id,
                    "breakpoint": breakpoint_timestamp,
                    "start": self.now - timedelta(days=3),
                    "end": self.now,
                },
            )

        assert response.status_code == 200, response.content

        # The spans occur within 1 hour of the breakpoint, so they're ignored
        # Before spans occur 1 hour before breakpoint
        # After spans occur 1 hour after breakpoint
        assert response.data == []

    def test_geo_code(self):
        breakpoint_timestamp = self.now - timedelta(days=1)

        # Before
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar", "geo.country_code": "US"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=10,
            days_before_now=2,
        )

        # Not in after
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar", "geo.country_code": "DE"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=10,
            days_before_now=2,
        )

        # After
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar", "geo.country_code": "US"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=100,
            hours_before_now=6,
        )

        # Not in before
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar", "geo.country_code": "MS"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=50,
            hours_before_now=6,
        )

        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "bar",
                    "project": self.project.id,
                    "breakpoint": breakpoint_timestamp,
                    "start": self.now - timedelta(days=3),
                    "end": self.now,
                    "type": "geo",
                },
            )

        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "geo.country_code": "US",
                "duration_before": 10.0,
                "duration_after": 100.0,
                "duration_delta": 90.0,
                "score": 0.08333333333333334,
            },
            {
                "geo.country_code": "MS",
                "duration_before": 0.0,
                "duration_after": 50.0,
                "duration_delta": 50.0,
                "score": 0.0462962962962963,
            },
        ]

    def test_geo_code_anaysis_ignores_empty_string_country_code(self):
        breakpoint_timestamp = self.now - timedelta(days=1)

        # Before
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar", "geo.country_code": ""},
            org_id=self.org.id,
            project_id=self.project.id,
            value=10,
            days_before_now=2,
        )

        # After
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar", "geo.country_code": ""},
            org_id=self.org.id,
            project_id=self.project.id,
            value=100,
            hours_before_now=6,
        )

        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "bar",
                    "project": self.project.id,
                    "breakpoint": breakpoint_timestamp,
                    "start": self.now - timedelta(days=3),
                    "end": self.now,
                    "type": "geo",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 0
