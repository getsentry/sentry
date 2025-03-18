from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from sentry.discover.compare_timeseries import compare_timeseries_for_alert_rule
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleProjects
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import BaseMetricsLayerTestCase, BaseSpansTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.user import User
from sentry.utils.samples import load_data

pytestmark = pytest.mark.sentry_metrics


@freeze_time()
class CompareAlertsTimeseriesTestCase(BaseMetricsLayerTestCase, TestCase, BaseSpansTestCase):
    @property
    def now(self):
        return datetime.now(UTC).replace(microsecond=0)

    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        with assume_test_silo_mode_of(User):
            self.user = User.objects.create(email="test@sentry.io")

        self.project_1 = self.create_project(organization=self.org)

        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.PERFORMANCE.value,
            dataset=Dataset.PerformanceMetrics.value,
            query="has:transaction.duration",
            aggregate="avg(transaction.duration)",
            time_window=3600,
            resolution=60,
        )

        self.alert_rule = AlertRule.objects.create(
            snuba_query=snuba_query,
            threshold_period=1,
            organization=self.project_1.organization,
        )

        AlertRuleProjects.objects.create(alert_rule=self.alert_rule, project=self.project_1)

        self.double_write_segment(
            project=self.project_1,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            transaction="foo",
            duration=50,
            exclusive_time=50,
            days_before_now=1,
        )

        self.double_write_segment(
            project=self.project_1,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            transaction="bar",
            duration=100,
            exclusive_time=100,
            days_before_now=2,
        )

    def double_write_segment(
        self,
        *,
        project,
        trace_id,
        transaction_id,
        span_id,
        duration,
        days_before_now: int = 0,
        hours_before_now: int = 0,
        minutes_before_now: int = 0,
        seconds_before_now: int = 0,
        **kwargs,
    ):
        kwargs.setdefault("measurements", {})
        if "lcp" not in kwargs["measurements"]:
            kwargs["measurements"]["lcp"] = duration
        if "client_sample_rate" not in kwargs["measurements"]:
            kwargs["measurements"]["client_sample_rate"] = 0.1

        timestamp = self.adjust_timestamp(
            self.now
            - timedelta(
                days=days_before_now,
                hours=hours_before_now,
                minutes=minutes_before_now,
                seconds=seconds_before_now,
            )
        )
        end_timestamp = timestamp + timedelta(microseconds=duration * 1000)

        data = load_data(
            "transaction",
            start_timestamp=timestamp,
            timestamp=end_timestamp,
            trace=trace_id,
            span_id=span_id,
            spans=[],
            event_id=transaction_id,
        )

        for measurement, value in kwargs.get("measurements", {}).items():
            data["measurements"][measurement] = {"value": value}

        if tags := kwargs.get("tags", {}):
            data["tags"] = [[key, val] for key, val in tags.items()]

        self.store_segment(
            project_id=project.id,
            trace_id=trace_id,
            transaction_id=transaction_id,
            span_id=span_id,
            timestamp=timestamp,
            duration=duration,
            organization_id=project.organization.id,
            is_eap=True,
            **kwargs,
        )

        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction.status": "unknown"},
            project_id=project.id,
            org_id=project.organization.id,
            value=duration,
            days_before_now=days_before_now,
            hours_before_now=hours_before_now,
            minutes_before_now=minutes_before_now,
            seconds_before_now=seconds_before_now,
        )

    def test_compare_simple(self):
        result = compare_timeseries_for_alert_rule(self.alert_rule)
        assert result["mismatches"] == {}

    def test_compare_mri_alert(self):
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.PERFORMANCE.value,
            dataset=Dataset.PerformanceMetrics.value,
            query="",
            aggregate="sum(c:spans/ai.total_cost@usd)",
            time_window=3600,
            resolution=60,
        )

        alert_rule = AlertRule.objects.create(
            snuba_query=snuba_query,
            threshold_period=1,
            organization=self.project_1.organization,
        )

        AlertRuleProjects.objects.create(alert_rule=alert_rule, project=self.project_1)
        result = compare_timeseries_for_alert_rule(alert_rule)
        assert result["skipped"] is True
