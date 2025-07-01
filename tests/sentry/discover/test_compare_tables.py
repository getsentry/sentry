from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from sentry.discover.compare_tables import (
    CompareTableResult,
    compare_tables_for_dashboard_widget_queries,
)
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, BaseSpansTestCase, TestCase
from sentry.utils.samples import load_data

pytestmark = pytest.mark.sentry_metrics


class CompareTablesTestCase(BaseMetricsLayerTestCase, TestCase, BaseSpansTestCase):
    @property
    def now(self):
        return datetime.now(UTC).replace(microsecond=0)

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.dashboard = self.create_dashboard(
            organization=self.organization, filters={"environment": []}
        )
        self.dashboard_2 = self.create_dashboard(
            organization=self.organization, filters={"environment": []}
        )
        self.environment = self.create_environment(
            organization=self.organization, project=self.project
        )
        self.dashboard_3 = self.create_dashboard(
            organization=self.organization, filters={"environment": [self.environment.name]}
        )
        self.dashboard.projects.set([self.project])
        self.dashboard_2.projects.set([])
        self.dashboard_3.projects.set([self.project])

        self.successful_widget_2 = DashboardWidget.objects.create(
            dashboard=self.dashboard_2,
            title="Test Successful Widget 2",
            order=0,
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
        )

        self.successful_widget_query_2 = DashboardWidgetQuery.objects.create(
            widget=self.successful_widget_2,
            name="Test Successful Widget Query 2",
            order=0,
            conditions="",
            aggregates=["count()"],
            columns=["count()", "transaction"],
            fields=["count()", "transaction"],
        )

        self.successful_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Test Successful Widget",
            order=0,
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
        )
        self.successful_widget_query = DashboardWidgetQuery.objects.create(
            widget=self.successful_widget,
            name="Test Successful Widget Query",
            order=0,
            conditions="",
            aggregates=["count()"],
            columns=["count()", "transaction"],
            fields=["count()", "transaction"],
        )

        self.error_field_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Test Empty Field Widget",
            order=1,
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
        )

        self.error_field_widget_query = DashboardWidgetQuery.objects.create(
            widget=self.error_field_widget,
            name="Test Empty Field Widget Query",
            order=1,
            conditions="",
            aggregates=["apdex()"],
            columns=["apdex()", "http.status_code"],
            fields=["apdex()", "http.status_code"],
        )

        self.empty_field_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Test Empty Field Widget",
            order=2,
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
        )

        self.empty_field_widget_query = DashboardWidgetQuery.objects.create(
            widget=self.empty_field_widget,
            name="Test Empty Field Widget Query",
            order=2,
            conditions="",
            aggregates=["failure_rate()", "count()"],
            columns=["failure_rate()", "count()", "http.status_code"],
            fields=["failure_rate()", "count()", "http.status_code"],
        )

        self.non_existent_field_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Test Non Existent Field Widget",
            order=3,
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
        )

        self.non_existent_field_widget_query = DashboardWidgetQuery.objects.create(
            widget=self.non_existent_field_widget,
            name="Test Non Existent Field Widget Query",
            order=3,
            conditions="",
            aggregates=[],
            columns=["non_existent_field", "http.status_code"],
            fields=["non_existent_field", "http.status_code"],
        )

        self.non_existent_field_widget_query_2 = DashboardWidgetQuery.objects.create(
            widget=self.non_existent_field_widget,
            name="Test Non Existent Field Widget Query 2",
            order=4,
            conditions="non_existent_field:1",
            aggregates=["count()"],
            columns=["count()", "http.status_code"],
            fields=["count()", "http.status_code"],
        )

        self.non_existent_eap_widget_query = DashboardWidgetQuery.objects.create(
            widget=self.non_existent_field_widget,
            name="Test Non Existent EAP Widget Query",
            order=5,
            conditions="title:hello level:info",
            aggregates=["count()"],
            columns=["count()", "http.status_code"],
            fields=["count()", "http.status_code"],
        )

        self.widget_with_environment_filter = DashboardWidget.objects.create(
            dashboard=self.dashboard_3,
            title="Test Erroring Widget",
            order=6,
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
        )

        self.widget_with_environment_filter_query = DashboardWidgetQuery.objects.create(
            widget=self.widget_with_environment_filter,
            name="Test Widget Query With Environment Filter",
            order=6,
            fields=["transaction", "count()"],
            conditions="!event.type:error",
            orderby="-count()",
            aggregates=["count()"],
            columns=["transaction"],
        )

        self.triple_write_segment(
            project=self.project,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            transaction="foo",
            duration=50,
            exclusive_time=50,
            days_before_now=1,
        )

        self.triple_write_segment(
            project=self.project,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            transaction="bar",
            duration=100,
            exclusive_time=100,
            days_before_now=2,
        )

        self.triple_write_segment(
            project=self.project,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            transaction="http",
            duration=100,
            exclusive_time=100,
            days_before_now=2,
            tags={"http.status_code": "200"},
        )

        self.triple_write_segment(
            project=self.project,
            trace_id=uuid4().hex,
            transaction_id=uuid4().hex,
            span_id="1" + uuid4().hex[:15],
            transaction="hello",
            duration=100,
            exclusive_time=100,
            days_before_now=2,
            tags={"http.status_code": "400"},
        )

    def triple_write_segment(
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

        data["transaction"] = kwargs.get("transaction", "hello")

        self.store_event(data, project_id=self.project.id)

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
            tags=tags,
            project_id=project.id,
            org_id=project.organization.id,
            value=duration,
            days_before_now=days_before_now,
            hours_before_now=hours_before_now,
            minutes_before_now=minutes_before_now,
            seconds_before_now=seconds_before_now,
        )

    def test_compare_successful_tables(self):
        comparison_result = compare_tables_for_dashboard_widget_queries(
            self.successful_widget_query
        )
        assert comparison_result["passed"]
        assert comparison_result["mismatches"] == []

    def test_compare_error_field_tables(self):
        # testing with apdex() field, which is not supported in EAP and throw an error
        comparison_result = compare_tables_for_dashboard_widget_queries(
            self.error_field_widget_query
        )
        assert comparison_result["passed"] is False
        assert comparison_result["reason"] == CompareTableResult.EAP_FAILED

    def test_compare_empty_field_tables(self):
        # testing with failure_rate() field, which is not supported in EAP
        comparison_result = compare_tables_for_dashboard_widget_queries(
            self.empty_field_widget_query
        )
        assert comparison_result["passed"] is False
        assert comparison_result["reason"] == CompareTableResult.FIELD_NOT_FOUND
        assert (
            comparison_result["mismatches"] is not None
            and "failure_rate()" in comparison_result["mismatches"]
        )

    def test_compare_non_existent_field_tables(self):
        comparison_result = compare_tables_for_dashboard_widget_queries(
            self.non_existent_field_widget_query
        )
        assert comparison_result["passed"] is False
        assert comparison_result["reason"] == CompareTableResult.FIELD_NOT_FOUND
        assert (
            comparison_result["mismatches"] is not None
            and "non_existent_field" in comparison_result["mismatches"]
        )

    def test_compare_non_existent_fields_tables_2(self):
        comparison_result = compare_tables_for_dashboard_widget_queries(
            self.non_existent_field_widget_query_2
        )
        assert comparison_result["passed"] is False
        assert comparison_result["reason"] == CompareTableResult.NO_DATA
        assert comparison_result["mismatches"] is not None and [] == comparison_result["mismatches"]

    def test_compare_non_existent_eap_widget_query(self):
        comparison_result = compare_tables_for_dashboard_widget_queries(
            self.non_existent_eap_widget_query
        )
        assert comparison_result["passed"] is False
        assert comparison_result["reason"] == CompareTableResult.QUERY_FAILED
        assert comparison_result["mismatches"] is not None and [] == comparison_result["mismatches"]

    def test_compare_widget_query_with_no_project(self):
        comparison_result = compare_tables_for_dashboard_widget_queries(
            self.successful_widget_query_2
        )
        assert comparison_result["passed"] is True
        assert comparison_result["mismatches"] == []

    def test_compare_widget_query_that_errors_out(self):
        comparison_result = compare_tables_for_dashboard_widget_queries(
            self.widget_with_environment_filter_query
        )
        assert comparison_result["passed"] is False
        # assert that both queries don't fail due to the environment filter
        assert comparison_result["reason"] != CompareTableResult.BOTH_FAILED

    def test_compare_widget_query_with_no_metrics_data(self):
        widget = DashboardWidget.objects.create(
            dashboard=self.dashboard_2,
            title="Test No Metrics Data Widget",
            order=1,
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
        )

        widget_query = DashboardWidgetQuery.objects.create(
            widget=widget,
            name="",
            order=0,
            conditions="",
            aggregates=["p75(measurements.app_start_warm)"],
            columns=["p75(measurements.app_start_warm)"],
            fields=["p75(measurements.app_start_warm)"],
        )

        comparison_result = compare_tables_for_dashboard_widget_queries(widget_query)
        assert comparison_result["passed"] is True
