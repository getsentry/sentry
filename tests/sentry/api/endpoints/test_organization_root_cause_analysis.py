from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data

ROOT_CAUSE_FEATURE_FLAG = "organizations:statistical-detectors-root-cause-analysis"

FEATURES = [ROOT_CAUSE_FEATURE_FLAG]

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
                    "breakpoint": (self.now - timedelta(days=1)).isoformat(),
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
                },
            )

        assert response.status_code == 400, response.content

    def test_breakpoint_must_be_in_the_past(self):
        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "foo",
                    "project": self.project.id,
                    "breakpoint": (self.now + timedelta(days=1)).isoformat(),
                },
            )

        assert response.status_code == 400, response.content

    def test_returns_counts_of_spans_before_and_after_breakpoint(self):
        # before
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            spans=None,
            project_id=self.project.id,
            start_timestamp=self.now - timedelta(days=2),
            duration=100,
        )
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="b" * 16,
            parent_span_id="b" * 16,
            spans=None,
            project_id=self.project.id,
            start_timestamp=self.now - timedelta(days=2),
            duration=100,
        )

        # after
        self.create_transaction(
            transaction="foo",
            trace_id=self.trace_id,
            span_id="c" * 16,
            parent_span_id="d" * 16,
            spans=None,
            project_id=self.project.id,
            start_timestamp=self.now,
            duration=100,
        )

        with self.feature(FEATURES):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "transaction": "foo",
                    "project": self.project.id,
                    "breakpoint": (self.now - timedelta(days=1)).isoformat(),
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["before"] == 2
        assert response.data["after"] == 1
