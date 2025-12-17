from unittest import mock

import pytest
from django.test import override_settings
from rest_framework.exceptions import ErrorDetail

from sentry.conf.types.sentry_config import SentryMode
from sentry.utils.snuba_rpc import table_rpc
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsTraceMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    dataset = "tracemetrics"

    def test_simple_with_explicit_filter(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": ["metric.name", "value"],
                "query": "metric.name:foo metric.type:counter",
                "orderby": "value",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "metric.name": "foo",
                "value": 1,
            },
        ]

    def test_simple_aggregation_with_explicit_filter(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": ["metric.name", "sum(value)"],
                "query": "metric.name:foo metric.type:counter",
                "orderby": "sum(value)",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "metric.name": "foo",
                "sum(value)": 1,
            },
        ]

    def test_simple(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "metricName": "foo",
                "metricType": "counter",
                "field": ["metric.name", "value"],
                "orderby": "value",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "metric.name": "foo",
                "value": 1,
            },
        ]

    def test_simple_aggregation(self) -> None:
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "metricName": "foo",
                "metricType": "counter",
                "field": ["metric.name", "sum(value)"],
                "orderby": "sum(value)",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "metric.name": "foo",
                "sum(value)": 1,
            },
        ]

    def test_sum(self):
        self.store_trace_metrics(
            [self.create_trace_metric("test_metric", i + 1, "counter") for i in range(6)]
        )

        response = self.do_request(
            {
                "metricName": "test_metric",
                "metricType": "counter",
                "field": ["sum(value)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sum(value)"] == 21
        assert meta["fields"]["sum(value)"] == "number"
        assert meta["dataset"] == "tracemetrics"

    def test_sum_with_counter_metric_type(self):
        counter_metrics = [
            self.create_trace_metric("request_count", 5.0, "counter"),
            self.create_trace_metric("request_count", 3.0, "counter"),
        ]
        self.store_trace_metrics(counter_metrics)

        response = self.do_request(
            {
                "metricName": "request_count",
                "metricType": "counter",
                "field": ["sum(value,request_count,counter,-)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sum(value,request_count,counter,-)"] == 8
        assert meta["fields"]["sum(value,request_count,counter,-)"] == "number"
        assert meta["dataset"] == "tracemetrics"

    def test_sum_with_distribution_metric_type(self):
        gauge_metrics = [
            self.create_trace_metric("request_duration", 75.0, "distribution"),
            self.create_trace_metric("request_duration", 80.0, "distribution"),
        ]
        self.store_trace_metrics(gauge_metrics)

        response = self.do_request(
            {
                "metricName": "request_duration",
                "metricType": "distribution",
                "field": [
                    "sum(value, request_duration, distribution, -)"
                ],  # Trying space in the formula here to make sure it works.
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0] == {
            "sum(value, request_duration, distribution, -)": 155,
        }

    def test_per_minute_formula(self) -> None:
        # Store 6 trace metrics over a 10 minute period
        self.store_trace_metrics(
            [self.create_trace_metric("test_metric", 1.0, "counter") for _ in range(6)]
        )

        response = self.do_request(
            {
                "metricName": "test_metric",
                "metricType": "counter",
                "field": ["per_minute(value)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["per_minute(value)"] == 0.6
        assert meta["fields"]["per_minute(value)"] == "rate"
        assert meta["dataset"] == "tracemetrics"

    def test_per_second_formula(self) -> None:
        # Store 6 trace metrics over a 10 minute period
        self.store_trace_metrics(
            [self.create_trace_metric("test_metric", 1.0, "counter") for _ in range(6)]
        )

        response = self.do_request(
            {
                "metricName": "test_metric",
                "metricType": "counter",
                "field": ["per_second(value)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert (
            data[0]["per_second(value)"] == 0.01
        )  # Over ten minute period, 6 events / 600 seconds = 0.01 events per second
        assert meta["fields"]["per_second(value)"] == "rate"
        assert meta["dataset"] == "tracemetrics"

    def test_per_second_formula_with_counter_metric_type(self) -> None:
        counter_metrics = [
            self.create_trace_metric("request_count", 5.0, "counter"),
            self.create_trace_metric("request_count", 3.0, "counter"),
        ]
        self.store_trace_metrics(counter_metrics)

        response = self.do_request(
            {
                "metricName": "request_count",
                "metricType": "counter",
                "field": ["per_second(value,request_count,counter,-)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0] == {
            "per_second(value,request_count,counter,-)": pytest.approx(8 / 600, abs=0.001)
        }

    def test_per_second_formula_with_gauge_metric_type(self) -> None:
        gauge_metrics = [
            self.create_trace_metric("cpu_usage", 75.0, "gauge"),
            self.create_trace_metric("cpu_usage", 80.0, "gauge"),
        ]
        self.store_trace_metrics(gauge_metrics)

        response = self.do_request(
            {
                "metricName": "cpu_usage",
                "metricType": "gauge",
                "field": [
                    "per_second(value, cpu_usage, gauge, -)"
                ],  # Trying space in the formula here to make sure it works.
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0] == {
            "per_second(value, cpu_usage, gauge, -)": pytest.approx(2 / 600, abs=0.001)
        }

    def test_per_second_formula_with_gauge_metric_type_without_top_level_metric_type(self) -> None:
        gauge_metrics = [
            self.create_trace_metric("cpu_usage", 75.0, "gauge"),
            self.create_trace_metric("cpu_usage", 80.0, "gauge"),
        ]
        self.store_trace_metrics(gauge_metrics)

        response = self.do_request(
            {
                "field": [
                    "per_second(value, cpu_usage, gauge, -)"
                ],  # Trying space in the formula here to make sure it works.
                "query": "metric.name:cpu_usage",
                "project": self.project.id,
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert data[0] == {
            "per_second(value, cpu_usage, gauge, -)": pytest.approx(2 / 600, abs=0.001)
        }

    def test_list_metrics(self):
        trace_metrics = [
            *[self.create_trace_metric("foo", 1, "counter") for _ in range(1)],
            *[self.create_trace_metric("bar", 1, "gauge") for _ in range(2)],
            *[self.create_trace_metric("baz", 1, "distribution") for _ in range(3)],
            *[self.create_trace_metric("qux", 1, "distribution", "millisecond") for _ in range(4)],
        ]
        self.store_trace_metrics(trace_metrics)

        # this query does not filter on any metrics, so scan all metrics
        response = self.do_request(
            {
                "field": [
                    "metric.name",
                    "metric.type",
                    "metric.unit",
                    "count(metric.name)",
                    "per_second(metric.name)",
                ],
                "orderby": "metric.name",
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "metric.name": "bar",
                "metric.type": "gauge",
                "metric.unit": None,
                "count(metric.name)": 2,
                "per_second(metric.name)": pytest.approx(2 / 600, abs=0.001),
            },
            {
                "metric.name": "baz",
                "metric.type": "distribution",
                "metric.unit": None,
                "count(metric.name)": 3,
                "per_second(metric.name)": pytest.approx(3 / 600, abs=0.001),
            },
            {
                "metric.name": "foo",
                "metric.type": "counter",
                "metric.unit": None,
                "count(metric.name)": 1,
                "per_second(metric.name)": pytest.approx(1 / 600, abs=0.001),
            },
            {
                "metric.name": "qux",
                "metric.type": "distribution",
                "metric.unit": "millisecond",
                "count(metric.name)": 4,
                "per_second(metric.name)": pytest.approx(4 / 600, abs=0.001),
            },
        ]

    def test_aggregation_embedded_metric_name(self):
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": ["count(value,foo,counter,-)"],
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"count(value,foo,counter,-)": 2},
        ]

    def test_aggregation_embedded_metric_name_formula(self):
        trace_metrics = [
            *[self.create_trace_metric("foo", 1, "counter") for _ in range(6)],
            self.create_trace_metric("bar", 594, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": ["per_second(value,foo,counter,-)"],
                "dataset": self.dataset,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            # Over ten minute period, 6 events / 600 seconds = 0.01 events per second
            {"per_second(value,foo,counter,-)": 0.01},
        ]

    def test_aggregation_multiple_embedded_same_metric_name(self):
        trace_metrics = [
            self.create_trace_metric("foo", 1, "distribution"),
            self.create_trace_metric("foo", 2, "distribution"),
            self.create_trace_metric("bar", 2, "counter"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": [
                    "min(value,foo,distribution,-)",
                    "max(value,foo,distribution,-)",
                ],
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "min(value,foo,distribution,-)": 1,
                "max(value,foo,distribution,-)": 2,
            },
        ]

    def test_aggregation_multiple_embedded_different_metric_name(self):
        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter"),
            self.create_trace_metric("foo", 2, "counter"),
            self.create_trace_metric("bar", 4, "counter"),
            self.create_trace_metric("baz", 8, "gauge"),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": [
                    "count(value,foo,counter,-)",
                    "count(value,bar,counter,-)",
                    "count(value,baz,gauge,-)",
                    "per_second(value,foo,counter,-)",
                    "per_second(value,bar,counter,-)",
                    "per_second(value,baz,gauge,-)",
                ],
                "dataset": self.dataset,
                "project": self.project.id,
                "statsPeriod": "10m",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "count(value,foo,counter,-)": 2,
                "count(value,bar,counter,-)": 1,
                "count(value,baz,gauge,-)": 1,
                "per_second(value,foo,counter,-)": pytest.approx(3 / 600, abs=0.001),
                "per_second(value,bar,counter,-)": pytest.approx(4 / 600, abs=0.001),
                "per_second(value,baz,gauge,-)": pytest.approx(1 / 600, abs=0.001),
            },
        ]

    def test_mixing_all_metrics_and_one_metric(self):
        response = self.do_request(
            {
                "field": [
                    "count(value,foo,counter,-)",
                    "per_second(value)",
                ],
                "dataset": self.dataset,
                "project": self.project.id,
            }
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": ErrorDetail(
                "Cannot aggregate all metrics and singlular metrics in the same query.",
                code="parse_error",
            )
        }

    @override_settings(SENTRY_MODE=SentryMode.SAAS)
    def test_no_project_sent_trace_metrics(self):
        project1 = self.create_project()
        project2 = self.create_project()

        request = {
            "field": [
                "timestamp",
                "metric.name",
                "metric.type",
                "value",
            ],
            "project": [project1.id, project2.id],
            "dataset": self.dataset,
            "sort": "-timestamp",
            "statsPeriod": "1h",
        }

        response = self.do_request(request)
        assert response.status_code == 200
        assert response.data["data"] == []

    @override_settings(SENTRY_MODE=SentryMode.SAAS)
    @mock.patch("sentry.utils.snuba_rpc.table_rpc", wraps=table_rpc)
    def test_sent_trace_metrics_project_optimization(self, mock_table_rpc):
        project1 = self.create_project()
        project2 = self.create_project()

        trace_metrics = [
            self.create_trace_metric("foo", 1, "counter", project=project1),
        ]
        self.store_trace_metrics(trace_metrics)

        response = self.do_request(
            {
                "field": [
                    "timestamp",
                    "metric.name",
                    "metric.type",
                    "value",
                ],
                "dataset": self.dataset,
                "project": [project1.id, project2.id],
            }
        )
        assert response.status_code == 200
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "timestamp": mock.ANY,
                "metric.name": "foo",
                "metric.type": "counter",
                "value": 1,
                "project.name": project1.slug,
            }
        ]

        mock_table_rpc.assert_called_once()
        assert mock_table_rpc.call_args.args[0][0].meta.project_ids == [project1.id]
