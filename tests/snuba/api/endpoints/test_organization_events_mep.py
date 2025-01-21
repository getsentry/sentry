from typing import Any
from unittest import mock

import pytest
from django.urls import reverse
from rest_framework.response import Response

from sentry.discover.models import DatasetSourcesTypes, TeamKeyTransaction
from sentry.models.dashboard_widget import DashboardWidgetTypes
from sentry.models.projectteam import ProjectTeam
from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events import constants
from sentry.search.utils import map_device_class_level
from sentry.snuba.metrics.extraction import (
    SPEC_VERSION_TWO_FLAG,
    MetricSpecType,
    OnDemandMetricSpec,
    OnDemandMetricSpecVersioning,
)
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.metrics.naming_layer.public import TransactionMetricKey
from sentry.snuba.utils import DATASET_OPTIONS
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.discover import user_misery_formula
from sentry.testutils.helpers.on_demand import create_widget
from sentry.utils.samples import load_data

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsMetricsEnhancedPerformanceEndpointTest(MetricsEnhancedPerformanceTestCase):
    viewname = "sentry-api-0-organization-events"

    # Poor intentionally omitted for test_measurement_rating_that_does_not_exist
    METRIC_STRINGS = [
        "foo_transaction",
        "bar_transaction",
        "baz_transaction",
        "staging",
        "measurement_rating",
        "good",
        "meh",
        "d:transactions/measurements.something_custom@millisecond",
        "d:transactions/measurements.runtime@hour",
        "d:transactions/measurements.bytes_transfered@byte",
        "d:transactions/measurements.datacenter_memory@petabyte",
        "d:transactions/measurements.custom.kilobyte@kilobyte",
        "d:transactions/measurements.longtaskcount@none",
        "d:transactions/measurements.percent@ratio",
        "d:transactions/measurements.custom_type@somethingcustom",
    ]

    def setUp(self):
        super().setUp()
        self.transaction_data = load_data("transaction", timestamp=before_now(minutes=1))
        self.features = {
            "organizations:performance-use-metrics": True,
        }

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        self.login_as(user=self.user)
        url = reverse(
            self.viewname,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request(
            {
                "dataset": "metricsEnhanced",
            }
        )

        assert response.status_code == 200, response.content

    def test_invalid_dataset(self):
        response = self.do_request(
            {
                "dataset": "aFakeDataset",
                "project": self.project.id,
            }
        )

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == f"dataset must be one of: {', '.join([key for key in DATASET_OPTIONS.keys()])}"
        )

    def test_out_of_retention(self):
        self.create_project()
        with self.options({"system.event-retention-days": 10}):
            query = {
                "field": ["id", "timestamp"],
                "orderby": ["-timestamp", "-id"],
                "query": "event.type:transaction",
                "start": before_now(days=20),
                "end": before_now(days=15),
                "dataset": "metricsEnhanced",
            }
            response = self.do_request(query)
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid date range. Please try a more recent date range."

    def test_invalid_search_terms(self):
        response = self.do_request(
            {
                "field": ["epm()"],
                "query": "hi \n there",
                "project": self.project.id,
                "dataset": "metricsEnhanced",
            }
        )
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Parse error at 'hi \n ther' (column 4). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )

    def test_percentile_with_no_data(self):
        response = self.do_request(
            {
                "field": ["p50()"],
                "query": "",
                "project": self.project.id,
                "dataset": "metricsEnhanced",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50()"] == 0

    def test_project_name(self):
        self.store_transaction_metric(
            1,
            tags={"environment": "staging"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["project.name", "environment", "epm()"],
                "query": "event.type:transaction",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["project.name"] == self.project.slug
        assert "project.id" not in data[0]
        assert data[0]["environment"] == "staging"

        assert meta["isMetricsData"]
        assert field_meta["project.name"] == "string"
        assert field_meta["environment"] == "string"
        assert field_meta["epm()"] == "rate"

    def test_project_id(self):
        self.store_transaction_metric(
            1,
            tags={"environment": "staging"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["project_id", "environment", "epm()"],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["project_id"] == self.project.id
        assert data[0]["environment"] == "staging"

        assert meta["isMetricsData"]
        assert field_meta["project_id"] == "integer"
        assert field_meta["environment"] == "string"
        assert field_meta["epm()"] == "rate"

    def test_project_dot_id(self):
        self.store_transaction_metric(
            1,
            tags={"environment": "staging"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["project.id", "environment", "epm()"],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["project.id"] == self.project.id
        assert data[0]["environment"] == "staging"

        assert meta["isMetricsData"]
        assert field_meta["project.id"] == "integer"
        assert field_meta["environment"] == "string"
        assert field_meta["epm()"] == "rate"

    def test_title_alias(self):
        """title is an alias to transaction name"""
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["title", "p50()"],
                "query": "event.type:transaction",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["title"] == "foo_transaction"
        assert data[0]["p50()"] == 1

        assert meta["isMetricsData"]
        assert field_meta["title"] == "string"
        assert field_meta["p50()"] == "duration"

    def test_having_condition(self):
        self.store_transaction_metric(
            1,
            tags={"environment": "staging", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            # shouldn't show up
            100,
            tags={"environment": "staging", "transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["transaction", "project", "p50(transaction.duration)"],
                "query": "event.type:transaction p50(transaction.duration):<50",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["project"] == self.project.slug
        assert data[0]["p50(transaction.duration)"] == 1

        assert meta["isMetricsData"]
        assert field_meta["transaction"] == "string"
        assert field_meta["project"] == "string"
        assert field_meta["p50(transaction.duration)"] == "duration"

    def test_having_condition_with_preventing_aggregates(self):
        self.store_transaction_metric(
            1,
            tags={"environment": "staging", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            tags={"environment": "staging", "transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["transaction", "project", "p50(transaction.duration)"],
                "query": "event.type:transaction p50(transaction.duration):<50",
                "dataset": "metricsEnhanced",
                "preventMetricAggregates": "1",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert not meta["isMetricsData"]
        assert field_meta["transaction"] == "string"
        assert field_meta["project"] == "string"
        assert field_meta["p50(transaction.duration)"] == "duration"

    def test_having_condition_with_preventing_aggregate_metrics_only(self):
        """same as the previous test, but with the dataset on explicit metrics
        which should throw a 400 error instead"""
        response = self.do_request(
            {
                "field": ["transaction", "project", "p50(transaction.duration)"],
                "query": "event.type:transaction p50(transaction.duration):<50",
                "dataset": "metrics",
                "preventMetricAggregates": "1",
                "per_page": 50,
                "project": self.project.id,
            }
        )
        assert response.status_code == 400, response.content

    def test_having_condition_not_selected(self):
        self.store_transaction_metric(
            1,
            tags={"environment": "staging", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            # shouldn't show up
            100,
            tags={"environment": "staging", "transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["transaction", "project", "p50(transaction.duration)"],
                "query": "event.type:transaction p75(transaction.duration):<50",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["project"] == self.project.slug
        assert data[0]["p50(transaction.duration)"] == 1

        assert meta["isMetricsData"]
        assert field_meta["transaction"] == "string"
        assert field_meta["project"] == "string"
        assert field_meta["p50(transaction.duration)"] == "duration"

    def test_non_metrics_tag_with_implicit_format(self):
        self.store_transaction_metric(
            1,
            tags={"environment": "staging", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["test", "p50(transaction.duration)"],
                "query": "event.type:transaction",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0
        assert not response.data["meta"]["isMetricsData"]

    def test_non_metrics_tag_with_implicit_format_metrics_dataset(self):
        self.store_transaction_metric(
            1,
            tags={"environment": "staging", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["test", "p50(transaction.duration)"],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 400, response.content

    @pytest.mark.querybuilder
    def test_performance_homepage_query(self):
        self.store_transaction_metric(
            1,
            tags={
                "transaction": "foo_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_SATISFIED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1,
            "measurements.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            2,
            "measurements.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            3,
            "measurements.fid",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            4,
            "measurements.cls",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1,
            "user",
            tags={
                "transaction": "foo_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_FRUSTRATED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        for dataset in ["metrics", "metricsEnhanced"]:
            response = self.do_request(
                {
                    "field": [
                        "transaction",
                        "project",
                        "tpm()",
                        "p75(measurements.fcp)",
                        "p75(measurements.lcp)",
                        "p75(measurements.fid)",
                        "p75(measurements.cls)",
                        "count_unique(user)",
                        "apdex()",
                        "count_miserable(user)",
                        "user_misery()",
                        "failure_rate()",
                        "failure_count()",
                    ],
                    "orderby": "tpm()",
                    "query": "event.type:transaction",
                    "dataset": dataset,
                    "per_page": 50,
                }
            )

            assert len(response.data["data"]) == 1
            data = response.data["data"][0]
            meta = response.data["meta"]
            field_meta = meta["fields"]

            assert data["transaction"] == "foo_transaction"
            assert data["project"] == self.project.slug
            assert data["p75(measurements.fcp)"] == 1.0
            assert data["p75(measurements.lcp)"] == 2.0
            assert data["p75(measurements.fid)"] == 3.0
            assert data["p75(measurements.cls)"] == 4.0
            assert data["apdex()"] == 1.0
            assert data["count_miserable(user)"] == 1.0
            assert data["user_misery()"] == 0.058
            assert data["failure_rate()"] == 1
            assert data["failure_count()"] == 1

            assert meta["isMetricsData"]
            assert field_meta["transaction"] == "string"
            assert field_meta["project"] == "string"
            assert field_meta["p75(measurements.fcp)"] == "duration"
            assert field_meta["p75(measurements.lcp)"] == "duration"
            assert field_meta["p75(measurements.fid)"] == "duration"
            assert field_meta["p75(measurements.cls)"] == "number"
            assert field_meta["apdex()"] == "number"
            assert field_meta["count_miserable(user)"] == "integer"
            assert field_meta["user_misery()"] == "number"
            assert field_meta["failure_rate()"] == "percentage"
            assert field_meta["failure_count()"] == "integer"
            assert field_meta["tpm()"] == "rate"

            assert meta["units"]["tpm()"] == "1/minute"

    def test_user_misery_and_team_key_sort(self):
        self.store_transaction_metric(
            1,
            tags={
                "transaction": "foo_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_SATISFIED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1,
            "measurements.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            2,
            "measurements.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            3,
            "measurements.fid",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            4,
            "measurements.cls",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1,
            "user",
            tags={
                "transaction": "foo_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_FRUSTRATED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "team_key_transaction",
                    "transaction",
                    "project",
                    "tpm()",
                    "p75(measurements.fcp)",
                    "p75(measurements.lcp)",
                    "p75(measurements.fid)",
                    "p75(measurements.cls)",
                    "count_unique(user)",
                    "apdex()",
                    "count_miserable(user)",
                    "user_misery()",
                    "failure_rate()",
                    "failure_count()",
                ],
                "orderby": ["team_key_transaction", "user_misery()"],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"][0]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data["transaction"] == "foo_transaction"
        assert data["project"] == self.project.slug
        assert data["p75(measurements.fcp)"] == 1.0
        assert data["p75(measurements.lcp)"] == 2.0
        assert data["p75(measurements.fid)"] == 3.0
        assert data["p75(measurements.cls)"] == 4.0
        assert data["apdex()"] == 1.0
        assert data["count_miserable(user)"] == 1.0
        assert data["user_misery()"] == 0.058
        assert data["failure_rate()"] == 1
        assert data["failure_count()"] == 1

        assert meta["isMetricsData"]
        assert field_meta["transaction"] == "string"
        assert field_meta["project"] == "string"
        assert field_meta["p75(measurements.fcp)"] == "duration"
        assert field_meta["p75(measurements.lcp)"] == "duration"
        assert field_meta["p75(measurements.fid)"] == "duration"
        assert field_meta["p75(measurements.cls)"] == "number"
        assert field_meta["apdex()"] == "number"
        assert field_meta["count_miserable(user)"] == "integer"
        assert field_meta["user_misery()"] == "number"
        assert field_meta["failure_rate()"] == "percentage"
        assert field_meta["failure_count()"] == "integer"

    def test_no_team_key_transactions(self):
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        self.store_transaction_metric(
            100, tags={"transaction": "bar_transaction"}, timestamp=self.min_ago
        )

        query = {
            "team": "myteams",
            "project": [self.project.id],
            # TODO sort by transaction here once that's possible for order to match the same test without metrics
            "orderby": "p95()",
            "field": [
                "team_key_transaction",
                "transaction",
                "transaction.status",
                "project",
                "epm()",
                "failure_rate()",
                "p95()",
            ],
            "per_page": 50,
            "dataset": "metricsEnhanced",
        }
        response = self.do_request(query)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 0
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["team_key_transaction"] == 0
        assert data[1]["transaction"] == "bar_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

    def test_team_key_transactions_my_teams(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        self.create_team_membership(team1, user=self.user)
        self.project.add_team(team1)

        team2 = self.create_team(organization=self.organization, name="Team B")
        self.project.add_team(team2)

        key_transactions = [
            (team1, "foo_transaction"),
            (team2, "baz_transaction"),
        ]

        # Not a key transaction
        self.store_transaction_metric(
            100, tags={"transaction": "bar_transaction"}, timestamp=self.min_ago
        )

        for team, transaction in key_transactions:
            self.store_transaction_metric(
                1, tags={"transaction": transaction}, timestamp=self.min_ago
            )
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                transaction=transaction,
                project_team=ProjectTeam.objects.get(project=self.project, team=team),
            )

        query = {
            "team": "myteams",
            "project": [self.project.id],
            "field": [
                "team_key_transaction",
                "transaction",
                "transaction.status",
                "project",
                "epm()",
                "failure_rate()",
                "p95()",
            ],
            "per_page": 50,
            "dataset": "metricsEnhanced",
        }

        query["orderby"] = ["team_key_transaction", "p95()"]
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 0
        assert data[0]["transaction"] == "baz_transaction"
        assert data[1]["team_key_transaction"] == 0
        assert data[1]["transaction"] == "bar_transaction"
        assert data[2]["team_key_transaction"] == 1
        assert data[2]["transaction"] == "foo_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

        # not specifying any teams should use my teams
        query = {
            "project": [self.project.id],
            "field": [
                "team_key_transaction",
                "transaction",
                "transaction.status",
                "project",
                "epm()",
                "failure_rate()",
                "p95()",
            ],
            "per_page": 50,
            "dataset": "metricsEnhanced",
        }

        query["orderby"] = ["team_key_transaction", "p95()"]
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 0
        assert data[0]["transaction"] == "baz_transaction"
        assert data[1]["team_key_transaction"] == 0
        assert data[1]["transaction"] == "bar_transaction"
        assert data[2]["team_key_transaction"] == 1
        assert data[2]["transaction"] == "foo_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

    def test_team_key_transactions_orderby(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        team2 = self.create_team(organization=self.organization, name="Team B")

        key_transactions = [
            (team1, "foo_transaction", 1),
            (team2, "baz_transaction", 100),
        ]

        # Not a key transaction
        self.store_transaction_metric(
            100, tags={"transaction": "bar_transaction"}, timestamp=self.min_ago
        )

        for team, transaction, value in key_transactions:
            self.store_transaction_metric(
                value, tags={"transaction": transaction}, timestamp=self.min_ago
            )
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                transaction=transaction,
                project_team=ProjectTeam.objects.get(project=self.project, team=team),
            )

        query = {
            "team": "myteams",
            "project": [self.project.id],
            "field": [
                "team_key_transaction",
                "transaction",
                "transaction.status",
                "project",
                "epm()",
                "failure_rate()",
                "p95()",
            ],
            "per_page": 50,
            "dataset": "metricsEnhanced",
        }

        # test ascending order
        query["orderby"] = ["team_key_transaction", "p95()"]
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 0
        assert data[0]["transaction"] == "bar_transaction"
        assert data[1]["team_key_transaction"] == 1
        assert data[1]["transaction"] == "foo_transaction"
        assert data[2]["team_key_transaction"] == 1
        assert data[2]["transaction"] == "baz_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

        # test descending order
        query["orderby"] = ["-team_key_transaction", "p95()"]
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 1
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["team_key_transaction"] == 1
        assert data[1]["transaction"] == "baz_transaction"
        assert data[2]["team_key_transaction"] == 0
        assert data[2]["transaction"] == "bar_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

    def test_team_key_transactions_query(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        team2 = self.create_team(organization=self.organization, name="Team B")

        key_transactions = [
            (team1, "foo_transaction", 1),
            (team2, "baz_transaction", 100),
        ]

        # Not a key transaction
        self.store_transaction_metric(
            100, tags={"transaction": "bar_transaction"}, timestamp=self.min_ago
        )

        for team, transaction, value in key_transactions:
            self.store_transaction_metric(
                value, tags={"transaction": transaction}, timestamp=self.min_ago
            )
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                transaction=transaction,
                project_team=ProjectTeam.objects.get(project=self.project, team=team),
            )

        query = {
            "team": "myteams",
            "project": [self.project.id],
            # use the order by to ensure the result order
            "orderby": "p95()",
            "field": [
                "team_key_transaction",
                "transaction",
                "transaction.status",
                "project",
                "epm()",
                "failure_rate()",
                "p95()",
            ],
            "per_page": 50,
            "dataset": "metricsEnhanced",
        }

        # key transactions
        query["query"] = "has:team_key_transaction"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 1
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["team_key_transaction"] == 1
        assert data[1]["transaction"] == "baz_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

        # key transactions
        query["query"] = "team_key_transaction:true"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 1
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["team_key_transaction"] == 1
        assert data[1]["transaction"] == "baz_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

        # not key transactions
        query["query"] = "!has:team_key_transaction"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 0
        assert data[0]["transaction"] == "bar_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

        # not key transactions
        query["query"] = "team_key_transaction:false"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 0
        assert data[0]["transaction"] == "bar_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

    def test_team_key_transaction_not_exists(self):
        team1 = self.create_team(organization=self.organization, name="Team A")
        team2 = self.create_team(organization=self.organization, name="Team B")

        key_transactions = [
            (team1, "foo_transaction", 1),
            (team2, "baz_transaction", 100),
        ]

        for team, transaction, value in key_transactions:
            self.store_transaction_metric(
                value, tags={"transaction": transaction}, timestamp=self.min_ago
            )
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                transaction=transaction,
                project_team=ProjectTeam.objects.get(project=self.project, team=team),
            )

        # Don't create a metric for this one
        TeamKeyTransaction.objects.create(
            organization=self.organization,
            transaction="not_in_metrics",
            project_team=ProjectTeam.objects.get(project=self.project, team=team1),
        )

        query = {
            "team": "myteams",
            "project": [self.project.id],
            # use the order by to ensure the result order
            "orderby": "p95()",
            "field": [
                "team_key_transaction",
                "transaction",
                "transaction.status",
                "project",
                "epm()",
                "failure_rate()",
                "p95()",
            ],
            "per_page": 50,
            "dataset": "metricsEnhanced",
        }

        # key transactions
        query["query"] = "has:team_key_transaction"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 1
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["team_key_transaction"] == 1
        assert data[1]["transaction"] == "baz_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

        # key transactions
        query["query"] = "team_key_transaction:true"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["team_key_transaction"] == 1
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["team_key_transaction"] == 1
        assert data[1]["transaction"] == "baz_transaction"

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

        # not key transactions
        query["query"] = "!has:team_key_transaction"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

        # not key transactions
        query["query"] = "team_key_transaction:false"
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert meta["isMetricsData"]
        assert field_meta["team_key_transaction"] == "boolean"
        assert field_meta["transaction"] == "string"

    def test_too_many_team_key_transactions(self):
        MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS = 1
        with mock.patch(
            "sentry.search.events.fields.MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS",
            MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS,
        ):
            team = self.create_team(organization=self.organization, name="Team A")
            self.create_team_membership(team, user=self.user)
            self.project.add_team(team)
            project_team = ProjectTeam.objects.get(project=self.project, team=team)
            transactions = ["foo_transaction", "bar_transaction", "baz_transaction"]

            for i in range(MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS + 1):
                self.store_transaction_metric(
                    100, tags={"transaction": transactions[i]}, timestamp=self.min_ago
                )

            TeamKeyTransaction.objects.bulk_create(
                [
                    TeamKeyTransaction(
                        organization=self.organization,
                        project_team=project_team,
                        transaction=transactions[i],
                    )
                    for i in range(MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS + 1)
                ]
            )

            query = {
                "team": "myteams",
                "project": [self.project.id],
                "orderby": "p95()",
                "field": [
                    "team_key_transaction",
                    "transaction",
                    "transaction.status",
                    "project",
                    "epm()",
                    "failure_rate()",
                    "p95()",
                ],
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }

            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 2
            data = response.data["data"]
            meta = response.data["meta"]

            assert (
                sum(row["team_key_transaction"] for row in data)
                == MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS
            )
            assert meta["isMetricsData"]

    def test_measurement_rating(self):
        self.store_transaction_metric(
            50,
            metric="measurements.lcp",
            tags={"measurement_rating": "good", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            15,
            metric="measurements.fp",
            tags={"measurement_rating": "good", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1500,
            metric="measurements.fcp",
            tags={"measurement_rating": "meh", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            125,
            metric="measurements.fid",
            tags={"measurement_rating": "meh", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.15,
            metric="measurements.cls",
            tags={"measurement_rating": "good", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "count_web_vitals(measurements.lcp, good)",
                    "count_web_vitals(measurements.fp, good)",
                    "count_web_vitals(measurements.fcp, meh)",
                    "count_web_vitals(measurements.fid, meh)",
                    "count_web_vitals(measurements.cls, good)",
                    "count_web_vitals(measurements.lcp, any)",
                ],
                "query": "event.type:transaction",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["count_web_vitals(measurements.lcp, good)"] == 1
        assert data[0]["count_web_vitals(measurements.fp, good)"] == 1
        assert data[0]["count_web_vitals(measurements.fcp, meh)"] == 1
        assert data[0]["count_web_vitals(measurements.fid, meh)"] == 1
        assert data[0]["count_web_vitals(measurements.cls, good)"] == 1
        assert data[0]["count_web_vitals(measurements.lcp, any)"] == 1

        assert meta["isMetricsData"]
        assert field_meta["count_web_vitals(measurements.lcp, good)"] == "integer"
        assert field_meta["count_web_vitals(measurements.fp, good)"] == "integer"
        assert field_meta["count_web_vitals(measurements.fcp, meh)"] == "integer"
        assert field_meta["count_web_vitals(measurements.fid, meh)"] == "integer"
        assert field_meta["count_web_vitals(measurements.cls, good)"] == "integer"
        assert field_meta["count_web_vitals(measurements.lcp, any)"] == "integer"

    def test_measurement_rating_that_does_not_exist(self):
        self.store_transaction_metric(
            1,
            metric="measurements.lcp",
            tags={"measurement_rating": "good", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["transaction", "count_web_vitals(measurements.lcp, poor)"],
                "query": "event.type:transaction",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["count_web_vitals(measurements.lcp, poor)"] == 0

        assert meta["isMetricsData"]
        assert meta["fields"]["count_web_vitals(measurements.lcp, poor)"] == "integer"

    def test_count_web_vitals_invalid_vital(self):
        query = {
            "field": [
                "count_web_vitals(measurements.foo, poor)",
            ],
            "project": [self.project.id],
            "dataset": "metricsEnhanced",
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

        query = {
            "field": [
                "count_web_vitals(tags[lcp], poor)",
            ],
            "project": [self.project.id],
            "dataset": "metricsEnhanced",
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

        query = {
            "field": [
                "count_web_vitals(transaction.duration, poor)",
            ],
            "project": [self.project.id],
            "dataset": "metricsEnhanced",
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

        query = {
            "field": [
                "count_web_vitals(measurements.lcp, bad)",
            ],
            "project": [self.project.id],
            "dataset": "metricsEnhanced",
        }
        response = self.do_request(query)
        assert response.status_code == 400, response.content

    def test_count_unique_user_returns_zero(self):
        self.store_transaction_metric(
            50,
            metric="user",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            50,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "orderby": "p50()",
            "field": [
                "transaction",
                "count_unique(user)",
                "p50()",
            ],
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["count_unique(user)"] == 1
        assert data[1]["transaction"] == "bar_transaction"
        assert data[1]["count_unique(user)"] == 0
        assert meta["isMetricsData"]

    def test_sum_transaction_duration(self):
        self.store_transaction_metric(
            50,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            150,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "orderby": "sum(transaction.duration)",
            "field": [
                "transaction",
                "sum(transaction.duration)",
            ],
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["sum(transaction.duration)"] == 300
        assert meta["isMetricsData"]

    def test_custom_measurements_simple(self):
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.something_custom@millisecond",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "orderby": "p50(measurements.something_custom)",
            "field": [
                "transaction",
                "p50(measurements.something_custom)",
            ],
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        self.wait_for_metric_count(
            self.project,
            1,
            metric="measurements.something_custom",
            mri="d:transactions/measurements.something_custom@millisecond",
        )
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["p50(measurements.something_custom)"] == 1
        assert meta["isMetricsData"]
        assert meta["fields"]["p50(measurements.something_custom)"] == "duration"
        assert meta["units"]["p50(measurements.something_custom)"] == "millisecond"

    def test_custom_measurement_size_meta_type(self):
        self.store_transaction_metric(
            100,
            metric="measurements.custom_type",
            internal_metric="d:transactions/measurements.custom_type@somethingcustom",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            metric="measurements.percent",
            internal_metric="d:transactions/measurements.percent@ratio",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            metric="measurements.longtaskcount",
            internal_metric="d:transactions/measurements.longtaskcount@none",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "orderby": "p50(measurements.longtaskcount)",
            "field": [
                "transaction",
                "p50(measurements.longtaskcount)",
                "p50(measurements.percent)",
                "p50(measurements.custom_type)",
            ],
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["p50(measurements.longtaskcount)"] == 100
        assert data[0]["p50(measurements.percent)"] == 100
        assert data[0]["p50(measurements.custom_type)"] == 100
        assert meta["isMetricsData"]
        assert meta["fields"]["p50(measurements.longtaskcount)"] == "integer"
        assert meta["units"]["p50(measurements.longtaskcount)"] is None
        assert meta["fields"]["p50(measurements.percent)"] == "percentage"
        assert meta["units"]["p50(measurements.percent)"] is None
        assert meta["fields"]["p50(measurements.custom_type)"] == "number"
        assert meta["units"]["p50(measurements.custom_type)"] is None

    def test_custom_measurement_none_type(self):
        self.store_transaction_metric(
            1,
            metric="measurements.cls",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "orderby": "p75(measurements.cls)",
            "field": [
                "transaction",
                "p75(measurements.cls)",
                "p99(measurements.cls)",
                "max(measurements.cls)",
            ],
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        self.wait_for_metric_count(
            self.project,
            1,
            metric=TransactionMetricKey.MEASUREMENTS_CLS.value,
            mri=TransactionMRI.MEASUREMENTS_CLS.value,
        )
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["p75(measurements.cls)"] == 1
        assert data[0]["p99(measurements.cls)"] == 1
        assert data[0]["max(measurements.cls)"] == 1
        assert meta["isMetricsData"]
        assert meta["fields"]["p75(measurements.cls)"] == "number"
        assert meta["units"]["p75(measurements.cls)"] is None
        assert meta["fields"]["p99(measurements.cls)"] == "number"
        assert meta["units"]["p99(measurements.cls)"] is None
        assert meta["fields"]["max(measurements.cls)"] == "number"
        assert meta["units"]["max(measurements.cls)"] is None

    def test_custom_measurement_duration_filtering(self):
        self.store_transaction_metric(
            1,
            metric="measurements.runtime",
            internal_metric="d:transactions/measurements.runtime@hour",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            180,
            metric="measurements.runtime",
            internal_metric="d:transactions/measurements.runtime@hour",
            entity="metrics_distributions",
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "field": [
                "transaction",
                "max(measurements.runtime)",
            ],
            "query": "p50(measurements.runtime):>1wk",
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "bar_transaction"
        assert data[0]["max(measurements.runtime)"] == 180
        assert meta["isMetricsData"]

    def test_custom_measurement_size_filtering(self):
        self.store_transaction_metric(
            1,
            metric="measurements.datacenter_memory",
            internal_metric="d:transactions/measurements.datacenter_memory@petabyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            metric="measurements.datacenter_memory",
            internal_metric="d:transactions/measurements.datacenter_memory@petabyte",
            entity="metrics_distributions",
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "field": [
                "transaction",
                "max(measurements.datacenter_memory)",
            ],
            "query": "p50(measurements.datacenter_memory):>5pb",
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "bar_transaction"
        assert data[0]["max(measurements.datacenter_memory)"] == 100
        assert meta["units"]["max(measurements.datacenter_memory)"] == "petabyte"
        assert meta["fields"]["max(measurements.datacenter_memory)"] == "size"
        assert meta["isMetricsData"]

    def test_has_custom_measurement(self):
        self.store_transaction_metric(
            33,
            metric="measurements.datacenter_memory",
            internal_metric="d:transactions/measurements.datacenter_memory@petabyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        transaction_data = load_data("transaction", timestamp=self.min_ago)
        transaction_data["measurements"]["datacenter_memory"] = {
            "value": 33,
            "unit": "petabyte",
        }
        self.store_event(transaction_data, self.project.id)

        measurement = "measurements.datacenter_memory"
        response = self.do_request(
            {
                "field": ["transaction", measurement],
                "query": "has:measurements.datacenter_memory",
                "dataset": "discover",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1

        response = self.do_request(
            {
                "field": ["transaction", measurement],
                "query": "!has:measurements.datacenter_memory",
                "dataset": "discover",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_environment_param(self):
        self.create_environment(self.project, name="staging")
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction", "environment": "staging"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "environment": "staging",
            "orderby": "p50(transaction.duration)",
            "field": [
                "transaction",
                "environment",
                "p50(transaction.duration)",
            ],
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["environment"] == "staging"
        assert data[0]["p50(transaction.duration)"] == 1
        assert meta["isMetricsData"]

    @pytest.mark.xfail(reason="Started failing on ClickHouse 21.8")
    def test_environment_query(self):
        self.create_environment(self.project, name="staging")
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction", "environment": "staging"},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "orderby": "p50(transaction.duration)",
            "field": [
                "transaction",
                "environment",
                "p50(transaction.duration)",
            ],
            "query": "!has:environment",
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        self.wait_for_metric_count(self.project, 2)
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["environment"] is None or data[0]["environment"] == ""
        assert data[0]["p50(transaction.duration)"] == 100
        assert meta["isMetricsData"]

    def test_has_transaction(self):
        self.store_transaction_metric(
            1,
            tags={},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "orderby": "p50(transaction.duration)",
            "field": [
                "transaction",
                "p50(transaction.duration)",
            ],
            "query": "has:transaction",
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        self.wait_for_metric_count(self.project, 2)
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "<< unparameterized >>"
        assert data[0]["p50(transaction.duration)"] == 1
        assert data[1]["transaction"] == "foo_transaction"
        assert data[1]["p50(transaction.duration)"] == 100
        assert meta["isMetricsData"]

        query = {
            "project": [self.project.id],
            "orderby": "p50(transaction.duration)",
            "field": [
                "transaction",
                "p50(transaction.duration)",
            ],
            "query": "!has:transaction",
            "statsPeriod": "24h",
            "dataset": "metricsEnhanced",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.content

    def test_apdex_transaction_threshold(self):
        ProjectTransactionThresholdOverride.objects.create(
            transaction="foo_transaction",
            project=self.project,
            organization=self.project.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )
        ProjectTransactionThresholdOverride.objects.create(
            transaction="bar_transaction",
            project=self.project,
            organization=self.project.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )
        self.store_transaction_metric(
            1,
            tags={
                "transaction": "foo_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_SATISFIED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1,
            "measurements.lcp",
            tags={
                "transaction": "bar_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_SATISFIED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "apdex()",
                ],
                "orderby": ["apdex()"],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )

        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["transaction"] == "bar_transaction"
        # Threshold is lcp based
        assert data[0]["apdex()"] == 1
        assert data[1]["transaction"] == "foo_transaction"
        # Threshold is lcp based
        assert data[1]["apdex()"] == 0

        assert meta["isMetricsData"]
        assert field_meta["transaction"] == "string"
        assert field_meta["apdex()"] == "number"

    def test_apdex_project_threshold(self):
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )
        self.store_transaction_metric(
            1,
            tags={
                "transaction": "foo_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_SATISFIED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1,
            "measurements.lcp",
            tags={
                "transaction": "bar_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_SATISFIED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "apdex()",
                ],
                "orderby": ["apdex()"],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["transaction"] == "bar_transaction"
        # Threshold is lcp based
        assert data[0]["apdex()"] == 1
        assert data[1]["transaction"] == "foo_transaction"
        # Threshold is lcp based
        assert data[1]["apdex()"] == 0

        assert meta["isMetricsData"]
        assert field_meta["transaction"] == "string"
        assert field_meta["apdex()"] == "number"

    def test_apdex_satisfaction_param(self):
        for function in ["apdex(300)", "user_misery(300)", "count_miserable(user, 300)"]:
            query = {
                "project": [self.project.id],
                "field": [
                    "transaction",
                    function,
                ],
                "statsPeriod": "24h",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }

            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 0
            meta = response.data["meta"]
            assert not meta["isMetricsData"], function

            query = {
                "project": [self.project.id],
                "field": [
                    "transaction",
                    function,
                ],
                "statsPeriod": "24h",
                "dataset": "metrics",
                "per_page": 50,
            }

            response = self.do_request(query)
            assert response.status_code == 400, function
            assert b"threshold parameter" in response.content, function

    def test_mobile_metrics(self):
        self.store_transaction_metric(
            0.4,
            "measurements.frames_frozen_rate",
            tags={
                "transaction": "bar_transaction",
            },
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "field": [
                "transaction",
                "p50(measurements.frames_frozen_rate)",
            ],
            "statsPeriod": "24h",
            "dataset": "metrics",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["p50(measurements.frames_frozen_rate)"] == 0.4

    def test_merge_null_unparam(self):
        self.store_transaction_metric(
            1,
            # Transaction: unparam
            tags={
                "transaction": "<< unparameterized >>",
            },
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            2,
            # Transaction:null
            tags={},
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "field": [
                "transaction",
                "p50(transaction.duration)",
            ],
            "statsPeriod": "24h",
            "dataset": "metrics",
            "per_page": 50,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["p50(transaction.duration)"] == 1.5

    def test_unparam_filter(self):
        self.store_transaction_metric(
            1,
            # Transaction: unparam
            tags={
                "transaction": "<< unparameterized >>",
            },
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            2,
            # Transaction:null
            tags={},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            3,
            tags={
                "transaction": "foo_transaction",
            },
            timestamp=self.min_ago,
        )

        query = {
            "project": [self.project.id],
            "field": [
                "transaction",
                "count()",
            ],
            "query": 'transaction:"<< unparameterized >>"',
            "statsPeriod": "24h",
            "dataset": "metrics",
            "per_page": 50,
        }

        self.wait_for_metric_count(self.project, 3)
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["transaction"] == "<< unparameterized >>"
        assert response.data["data"][0]["count()"] == 2

    def test_custom_measurements_without_function(self):
        self.store_transaction_metric(
            33,
            metric="measurements.datacenter_memory",
            internal_metric="d:transactions/measurements.datacenter_memory@petabyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        transaction_data = load_data("transaction", timestamp=self.min_ago)
        transaction_data["measurements"]["datacenter_memory"] = {
            "value": 33,
            "unit": "petabyte",
        }
        self.store_event(transaction_data, self.project.id)

        measurement = "measurements.datacenter_memory"
        response = self.do_request(
            {
                "field": ["transaction", measurement],
                "query": "measurements.datacenter_memory:33pb",
                "dataset": "discover",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0][measurement] == 33

        meta = response.data["meta"]
        field_meta = meta["fields"]
        unit_meta = meta["units"]
        assert field_meta[measurement] == "size"
        assert unit_meta[measurement] == "petabyte"
        assert not meta["isMetricsData"]

    def test_custom_measurements_with_function(self):
        self.store_transaction_metric(
            33,
            metric="measurements.datacenter_memory",
            internal_metric="d:transactions/measurements.datacenter_memory@petabyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        transaction_data = load_data("transaction", timestamp=self.min_ago)
        transaction_data["measurements"]["datacenter_memory"] = {
            "value": 33,
            "unit": "petabyte",
        }
        self.store_event(transaction_data, self.project.id)

        measurement = "p50(measurements.datacenter_memory)"
        response = self.do_request(
            {
                "field": ["transaction", measurement],
                "query": "measurements.datacenter_memory:33pb",
                "dataset": "discover",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0][measurement] == 33

        meta = response.data["meta"]
        field_meta = meta["fields"]
        unit_meta = meta["units"]
        assert field_meta[measurement] == "size"
        assert unit_meta[measurement] == "petabyte"
        assert not meta["isMetricsData"]

    def test_custom_measurements_equation(self):
        self.store_transaction_metric(
            33,
            metric="measurements.datacenter_memory",
            internal_metric="d:transactions/measurements.datacenter_memory@petabyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        transaction_data = load_data("transaction", timestamp=self.min_ago)
        transaction_data["measurements"]["datacenter_memory"] = {
            "value": 33,
            "unit": "petabyte",
        }
        self.store_event(transaction_data, self.project.id)

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "measurements.datacenter_memory",
                    "equation|measurements.datacenter_memory / 3",
                ],
                "query": "",
                "dataset": "discover",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["measurements.datacenter_memory"] == 33
        assert data[0]["equation|measurements.datacenter_memory / 3"] == 11

        meta = response.data["meta"]
        assert not meta["isMetricsData"]

    def test_transaction_wildcard(self):
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "p90()",
                ],
                "query": "transaction:foo*",
                "dataset": "metrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p90()"] == 1

        meta = response.data["meta"]
        assert meta["isMetricsData"]
        assert data[0]["transaction"] == "foo_transaction"

    def test_transaction_status_wildcard(self):
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction", "transaction.status": "foobar"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "p90()",
                ],
                "query": "transaction.status:f*bar",
                "dataset": "metrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p90()"] == 1

        meta = response.data["meta"]
        assert meta["isMetricsData"]

    def test_http_error_rate(self):
        self.store_transaction_metric(
            1,
            tags={
                "transaction": "foo_transaction",
                "transaction.status": "foobar",
                "http.status_code": "500",
            },
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            1,
            tags={"transaction": "bar_transaction", "http.status_code": "400"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "http_error_rate()",
                ],
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["http_error_rate()"] == 0.5
        meta = response.data["meta"]
        assert meta["isMetricsData"]

    def test_time_spent(self):
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction", "transaction.status": "foobar"},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            1,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "time_spent_percentage()",
                ],
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["time_spent_percentage()"] == 0.5
        meta = response.data["meta"]
        assert meta["isMetricsData"]

    def test_has_filter(self):
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction", "transaction.status": "foobar"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "p50()",
                ],
                # For the metrics dataset, has on metrics should be no-ops
                "query": "has:measurements.frames_frozen_rate",
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50()"] == 1
        meta = response.data["meta"]
        assert meta["isMetricsData"]

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "p50()",
                ],
                "query": "has:transaction.status",
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["p50()"] == 1
        meta = response.data["meta"]
        assert meta["isMetricsData"]

    def test_not_has_filter(self):
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction", "transaction.status": "foobar"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "p50()",
                ],
                "query": "!has:transaction.status",
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 0
        meta = response.data["meta"]
        assert meta["isMetricsData"]

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "p50()",
                ],
                # Doing !has on the metrics dataset doesn't really make sense
                "query": "!has:measurements.frames_frozen_rate",
                "dataset": "metrics",
            }
        )

        assert response.status_code == 400, response.content

    def test_p50_with_count(self):
        """Implicitly test the fact that percentiles are their own 'dataset'"""
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["title", "p50()", "count()"],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "project": self.project.id,
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["title"] == "foo_transaction"
        assert data[0]["p50()"] == 1
        assert data[0]["count()"] == 1

        assert meta["isMetricsData"]
        assert field_meta["title"] == "string"
        assert field_meta["p50()"] == "duration"
        assert field_meta["count()"] == "integer"

    def test_p75_with_count_and_more_groupby(self):
        """Implicitly test the fact that percentiles are their own 'dataset'"""
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            5,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            5,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "title",
                    "project",
                    "p75()",
                    "count()",
                ],
                "query": "event.type:transaction",
                "orderby": "count()",
                "dataset": "metrics",
                "project": self.project.id,
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["title"] == "foo_transaction"
        assert data[0]["p75()"] == 1
        assert data[0]["count()"] == 1

        assert data[1]["title"] == "bar_transaction"
        assert data[1]["p75()"] == 5
        assert data[1]["count()"] == 2

        assert meta["isMetricsData"]
        assert field_meta["title"] == "string"
        assert field_meta["p75()"] == "duration"
        assert field_meta["count()"] == "integer"

    def test_title_and_transaction_alias(self):
        # Title and transaction are aliases to the same column
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "title",
                    "transaction",
                    "p75()",
                ],
                "query": "event.type:transaction",
                "orderby": "p75()",
                "dataset": "metrics",
                "project": self.project.id,
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["title"] == "foo_transaction"
        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["p75()"] == 1

        assert meta["isMetricsData"]
        assert field_meta["title"] == "string"
        assert field_meta["transaction"] == "string"
        assert field_meta["p75()"] == "duration"

    def test_maintain_sort_order_across_datasets(self):
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            5,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            5,
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "title",
                    "project",
                    "count()",
                    "count_unique(user)",
                ],
                "query": "event.type:transaction",
                "orderby": "count()",
                "dataset": "metrics",
                "project": self.project.id,
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert len(data) == 2

        assert data[0]["title"] == "foo_transaction"
        assert data[0]["count()"] == 1
        assert data[0]["count_unique(user)"] == 0

        assert data[1]["title"] == "bar_transaction"
        assert data[1]["count()"] == 2
        assert data[1]["count_unique(user)"] == 1

        assert meta["isMetricsData"]
        assert field_meta["title"] == "string"
        assert field_meta["count()"] == "integer"
        assert field_meta["count_unique(user)"] == "integer"

    def test_avg_compare(self):
        self.store_transaction_metric(
            100,
            timestamp=self.min_ago,
            tags={"release": "foo"},
        )
        self.store_transaction_metric(
            10,
            timestamp=self.min_ago,
            tags={"release": "bar"},
        )

        for function_name in [
            "avg_compare(transaction.duration, release, foo, bar)",
            'avg_compare(transaction.duration, release, "foo", "bar")',
        ]:
            response = self.do_request(
                {
                    "field": [function_name],
                    "query": "",
                    "project": self.project.id,
                    "dataset": "metrics",
                }
            )
            assert response.status_code == 200, response.content

            data = response.data["data"]
            meta = response.data["meta"]

            assert len(data) == 1
            assert data[0][function_name] == -0.9

            assert meta["dataset"] == "metrics"
            assert meta["fields"][function_name] == "percent_change"

    def test_avg_if(self):
        self.store_transaction_metric(
            100,
            timestamp=self.min_ago,
            tags={"release": "foo"},
        )
        self.store_transaction_metric(
            200,
            timestamp=self.min_ago,
            tags={"release": "foo"},
        )
        self.store_transaction_metric(
            10,
            timestamp=self.min_ago,
            tags={"release": "bar"},
        )

        response = self.do_request(
            {
                "field": ["avg_if(transaction.duration, release, foo)"],
                "query": "",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]

        assert len(data) == 1
        assert data[0]["avg_if(transaction.duration, release, foo)"] == 150

        assert meta["dataset"] == "metrics"
        assert meta["fields"]["avg_if(transaction.duration, release, foo)"] == "duration"

    def test_count_if(self):
        self.store_transaction_metric(
            100,
            timestamp=self.min_ago,
            tags={"release": "1.0.0"},
        )
        self.store_transaction_metric(
            200,
            timestamp=self.min_ago,
            tags={"release": "1.0.0"},
        )
        self.store_transaction_metric(
            10,
            timestamp=self.min_ago,
            tags={"release": "2.0.0"},
        )

        countIfRelease1 = "count_if(transaction.duration,release,1.0.0)"
        countIfRelease2 = "count_if(transaction.duration,release,2.0.0)"

        response = self.do_request(
            {
                "field": [
                    countIfRelease1,
                    countIfRelease2,
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]

        assert len(data) == 1
        assert data[0][countIfRelease1] == 2
        assert data[0][countIfRelease2] == 1

        assert meta["dataset"] == "metrics"
        assert meta["fields"][countIfRelease1] == "integer"
        assert meta["fields"][countIfRelease2] == "integer"

    def test_device_class(self):
        self.store_transaction_metric(
            100,
            timestamp=self.min_ago,
            tags={"device.class": "1"},
        )
        self.store_transaction_metric(
            200,
            timestamp=self.min_ago,
            tags={"device.class": "2"},
        )
        self.store_transaction_metric(
            300,
            timestamp=self.min_ago,
            tags={"device.class": ""},
        )
        response = self.do_request(
            {
                "field": ["device.class", "p95()"],
                "query": "",
                "orderby": "p95()",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 3
        # Need to actually check the dict since the level for 1 isn't guaranteed to stay `low` or `medium`
        assert data[0]["device.class"] == map_device_class_level("1")
        assert data[1]["device.class"] == map_device_class_level("2")
        assert data[2]["device.class"] == "Unknown"
        assert meta["fields"]["device.class"] == "string"

    def test_device_class_filter(self):
        self.store_transaction_metric(
            300,
            timestamp=self.min_ago,
            tags={"device.class": "1"},
        )
        # Need to actually check the dict since the level for 1 isn't guaranteed to stay `low`
        level = map_device_class_level("1")
        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": f"device.class:{level}",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["device.class"] == level
        assert meta["fields"]["device.class"] == "string"

    def test_performance_score(self):
        self.store_transaction_metric(
            0.03,
            metric="measurements.score.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.35,
            metric="measurements.score.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.70,
            metric="measurements.score.weight.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.38,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            1.00,
            metric="measurements.score.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.00,
            metric="measurements.score.weight.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.00,
            metric="measurements.score.fid",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        # These fid and ttfb scenarios shouldn't really be happening, but we can test them anyways
        self.store_transaction_metric(
            0.00,
            metric="measurements.score.weight.fid",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.00,
            metric="measurements.score.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.00,
            metric="measurements.score.weight.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.00,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        # INP metrics
        self.store_transaction_metric(
            0.80,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.00,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.80,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "performance_score(measurements.score.fcp)",
                    "performance_score(measurements.score.fid)",
                    "performance_score(measurements.score.ttfb)",
                    "performance_score(measurements.score.inp)",
                ],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["performance_score(measurements.score.fcp)"] == 0.5
        assert data[0]["performance_score(measurements.score.fid)"] == 0
        assert data[0]["performance_score(measurements.score.ttfb)"] == 0.7923076923076923
        assert data[0]["performance_score(measurements.score.inp)"] == 0.8

        assert meta["isMetricsData"]
        assert field_meta["performance_score(measurements.score.ttfb)"] == "number"

    def test_performance_score_boundaries(self):
        # Scores shouldn't exceed 1 or go below 0, but we can test these boundaries anyways
        self.store_transaction_metric(
            0.65,
            metric="measurements.score.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            -0.35,
            metric="measurements.score.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.70,
            metric="measurements.score.weight.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.3,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "performance_score(measurements.score.ttfb)",
                    "performance_score(measurements.score.fcp)",
                ],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        field_meta = meta["fields"]

        assert data[0]["performance_score(measurements.score.ttfb)"] == 1.0
        assert data[0]["performance_score(measurements.score.fcp)"] == 0.0

        assert meta["isMetricsData"]
        assert field_meta["performance_score(measurements.score.ttfb)"] == "number"

    def test_invalid_performance_score_column(self):
        self.store_transaction_metric(
            0.03,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "performance_score(measurements.score.fp)",
                ],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 400, response.content

    def test_opportunity_score(self):
        self.store_transaction_metric(
            0.03,
            metric="measurements.score.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.40,
            metric="measurements.score.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.70,
            metric="measurements.score.weight.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.43,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            1.0,
            metric="measurements.score.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.0,
            metric="measurements.score.weight.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.0,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            0.0,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            0.80,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.00,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.80,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "opportunity_score(measurements.score.ttfb)",
                    "opportunity_score(measurements.score.inp)",
                    "opportunity_score(measurements.score.total)",
                ],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["opportunity_score(measurements.score.ttfb)"] == 0.27
        # Should be 0.2. Precision issue?
        assert data[0]["opportunity_score(measurements.score.inp)"] == 0.19999999999999996
        assert data[0]["opportunity_score(measurements.score.total)"] == 1.77

        assert meta["isMetricsData"]

    def test_opportunity_score_with_fixed_weights(self):
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.0,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.2,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.0,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.2,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.1,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.3,
            metric="measurements.score.weight.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.2,
            metric="measurements.score.inp",
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.weight.inp",
            tags={"transaction": "bar_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "total_opportunity_score()",
                ],
                "query": "event.type:transaction",
                "orderby": "transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["total_opportunity_score()"] == 0.029999999999999995
        assert data[1]["total_opportunity_score()"] == 0.36
        assert meta["isMetricsData"]

    def test_opportunity_score_with_fixed_weights_and_missing_vitals(self):
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.0,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.2,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.0,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.2,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.1,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction", "browser.name": "Firefox"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.3,
            metric="measurements.score.weight.lcp",
            tags={"transaction": "foo_transaction", "browser.name": "Firefox"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.2,
            metric="measurements.score.inp",
            tags={"transaction": "bar_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.weight.inp",
            tags={"transaction": "bar_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.total",
            tags={"transaction": "bar_transaction", "browser.name": "Safari"},
            timestamp=self.min_ago,
        )

        with self.feature({"organizations:performance-vitals-handle-missing-webvitals": True}):
            response = self.do_request(
                {
                    "field": [
                        "transaction",
                        "total_opportunity_score()",
                    ],
                    "query": 'event.type:transaction transaction.op:[pageload,""] (browser.name:Safari OR browser.name:Firefox) avg(measurements.score.total):>0',
                    "orderby": "transaction",
                    "dataset": "metrics",
                    "per_page": 50,
                }
            )
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 2
            data = response.data["data"]
            meta = response.data["meta"]

            assert data[0]["total_opportunity_score()"] == 0.09999999999999999
            assert data[1]["total_opportunity_score()"] == 0.6
            assert meta["isMetricsData"]

    def test_total_performance_score(self):
        self.store_transaction_metric(
            0.03,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.lcp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.15,
            metric="measurements.score.fcp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.15,
            metric="measurements.score.weight.fcp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.10,
            metric="measurements.score.cls",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.15,
            metric="measurements.score.weight.cls",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.05,
            metric="measurements.score.ttfb",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.10,
            metric="measurements.score.weight.ttfb",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.05,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.10,
            metric="measurements.score.weight.inp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "performance_score(measurements.score.total)",
                ],
                "query": "",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]
        assert data[0]["performance_score(measurements.score.total)"] == 0.48
        assert meta["isMetricsData"]

    def test_total_performance_score_with_missing_vitals(self):
        self.store_transaction_metric(
            0.03,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.lcp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.15,
            metric="measurements.score.fcp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.15,
            metric="measurements.score.weight.fcp",
            tags={"transaction": "foo_transaction", "transaction.op": "pageload"},
            timestamp=self.min_ago,
        )
        with self.feature({"organizations:performance-vitals-handle-missing-webvitals": True}):
            response = self.do_request(
                {
                    "field": [
                        "transaction",
                        "performance_score(measurements.score.total)",
                    ],
                    "query": "",
                    "dataset": "metrics",
                    "per_page": 50,
                }
            )
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) == 1
            data = response.data["data"]
            meta = response.data["meta"]
            assert data[0]["performance_score(measurements.score.total)"] == 0.4
            assert meta["isMetricsData"]

    def test_count_scores(self):
        self.store_transaction_metric(
            0.1,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.2,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.3,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.4,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.5,
            metric="measurements.score.ttfb",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.8,
            metric="measurements.score.inp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "count_scores(measurements.score.total)",
                    "count_scores(measurements.score.ttfb)",
                    "count_scores(measurements.score.inp)",
                ],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["count_scores(measurements.score.total)"] == 4
        assert data[0]["count_scores(measurements.score.ttfb)"] == 1
        assert data[0]["count_scores(measurements.score.inp)"] == 1

        assert meta["isMetricsData"]

    def test_count_starts(self):
        self.store_transaction_metric(
            200,
            metric="measurements.app_start_warm",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            metric="measurements.app_start_warm",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            10,
            metric="measurements.app_start_cold",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "count_starts(measurements.app_start_warm)",
                    "count_starts(measurements.app_start_cold)",
                ],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["count_starts(measurements.app_start_warm)"] == 2
        assert data[0]["count_starts(measurements.app_start_cold)"] == 1

        assert meta["isMetricsData"]

    def test_count_starts_returns_all_counts_when_no_arg_is_passed(self):
        self.store_transaction_metric(
            200,
            metric="measurements.app_start_warm",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            100,
            metric="measurements.app_start_warm",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            10,
            metric="measurements.app_start_cold",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "count_total_starts()",
                ],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["count_total_starts()"] == 3

        assert meta["isMetricsData"]

    def test_timestamp_groupby(self):
        self.store_transaction_metric(
            0.03,
            tags={"transaction": "foo_transaction", "user": "foo"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "timestamp",
                    "count()",
                    "count_unique(user)",
                ],
                "query": "event.type:transaction",
                "dataset": "metricsEnhanced",
                "per_page": 50,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert meta["dataset"] == "metricsEnhanced"

    def test_on_demand_with_mep(self):
        # Store faketag as an OnDemandMetricSpec, which will put faketag into the metrics indexer
        spec = OnDemandMetricSpec(
            field="count()",
            query="user.email:blah@example.com",
            environment="prod",
            groupbys=["faketag"],
            spec_type=MetricSpecType.DYNAMIC_QUERY,
        )
        self.store_on_demand_metric(123, spec=spec)

        # This is the event that we should actually return
        transaction_data = load_data("transaction", timestamp=self.min_ago)
        transaction_data["tags"].append(("faketag", "foo"))
        self.store_event(transaction_data, self.project.id)

        with self.feature({"organizations:mep-use-default-tags": True}):
            response = self.do_request(
                {
                    "field": [
                        "faketag",
                        "count()",
                    ],
                    "query": "event.type:transaction",
                    "dataset": "metricsEnhanced",
                    "per_page": 50,
                }
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["faketag"] == "foo"
        assert not meta["isMetricsData"]

    def test_filtering_by_org_id_is_not_compatible(self):
        """Implicitly test the fact that percentiles are their own 'dataset'"""
        self.store_transaction_metric(
            1,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": ["title", "p50()", "count()"],
                "query": "event.type:transaction organization_id:2",
                "dataset": "metrics",
                "project": self.project.id,
                "per_page": 50,
            }
        )
        assert response.status_code == 400, response.content

    def test_cache_miss_rate(self):
        self.store_span_metric(
            1,
            timestamp=self.min_ago,
            tags={"cache.hit": "true"},
        )
        self.store_span_metric(
            1,
            timestamp=self.min_ago,
            tags={"cache.hit": "false"},
        )
        self.store_span_metric(
            1,
            timestamp=self.min_ago,
            tags={"cache.hit": "false"},
        )
        self.store_span_metric(
            1,
            timestamp=self.min_ago,
            tags={"cache.hit": "false"},
        )
        response = self.do_request(
            {
                "field": ["cache_miss_rate()"],
                "query": "",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["cache_miss_rate()"] == 0.75
        assert meta["dataset"] == "metrics"
        assert meta["fields"]["cache_miss_rate()"] == "percentage"

    def test_http_response_rate(self):
        self.store_span_metric(
            1,
            timestamp=self.min_ago,
            tags={"span.status_code": "200"},
        )

        self.store_span_metric(
            3,
            timestamp=self.min_ago,
            tags={"span.status_code": "301"},
        )

        self.store_span_metric(
            3,
            timestamp=self.min_ago,
            tags={"span.status_code": "404"},
        )

        self.store_span_metric(
            4,
            timestamp=self.min_ago,
            tags={"span.status_code": "503"},
        )

        self.store_span_metric(
            5,
            timestamp=self.min_ago,
            tags={"span.status_code": "501"},
        )

        response = self.do_request(
            {
                "field": [
                    "http_response_rate(200)",  # By exact code
                    "http_response_rate(3)",  # By code class
                    "http_response_rate(4)",
                    "http_response_rate(5)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["http_response_rate(200)"] == 0.2
        assert data[0]["http_response_rate(3)"] == 0.2
        assert data[0]["http_response_rate(4)"] == 0.2
        assert data[0]["http_response_rate(5)"] == 0.4

        meta = response.data["meta"]
        assert meta["dataset"] == "metrics"
        assert meta["fields"]["http_response_rate(200)"] == "percentage"

    def test_avg_span_self_time(self):
        self.store_span_metric(
            1,
            timestamp=self.min_ago,
        )

        self.store_span_metric(
            3,
            timestamp=self.min_ago,
        )

        self.store_span_metric(
            3,
            timestamp=self.min_ago,
        )

        self.store_span_metric(
            4,
            timestamp=self.min_ago,
        )

        self.store_span_metric(
            5,
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "avg(span.self_time)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["avg(span.self_time)"] == 3.2

    def test_avg_message_receive_latency_gauge_functions(self):
        self.store_span_metric(
            {
                "min": 5,
                "max": 5,
                "sum": 5,
                "count": 1,
                "last": 5,
            },
            internal_metric=constants.SPAN_MESSAGING_LATENCY,
            timestamp=self.min_ago,
            entity="metrics_gauges",
        )
        self.store_span_metric(
            {
                "min": 15,
                "max": 15,
                "sum": 15,
                "count": 1,
                "last": 15,
            },
            internal_metric=constants.SPAN_MESSAGING_LATENCY,
            timestamp=self.min_ago,
            entity="metrics_gauges",
        )

        response = self.do_request(
            {
                "field": [
                    "avg(messaging.message.receive.latency)",
                    "sum(messaging.message.receive.latency)",
                    "min(messaging.message.receive.latency)",
                    "max(messaging.message.receive.latency)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["avg(messaging.message.receive.latency)"] == 10.0
        assert data[0]["sum(messaging.message.receive.latency)"] == 20.0
        assert data[0]["min(messaging.message.receive.latency)"] == 5.0
        assert data[0]["max(messaging.message.receive.latency)"] == 15.0

        response = self.do_request(
            {
                "field": [
                    "avg(g:spans/messaging.message.receive.latency@millisecond)",
                    "sum(g:spans/messaging.message.receive.latency@millisecond)",
                    "min(g:spans/messaging.message.receive.latency@millisecond)",
                    "max(g:spans/messaging.message.receive.latency@millisecond)",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["avg(g:spans/messaging.message.receive.latency@millisecond)"] == 10.0
        assert data[0]["sum(g:spans/messaging.message.receive.latency@millisecond)"] == 20.0
        assert data[0]["min(g:spans/messaging.message.receive.latency@millisecond)"] == 5.0
        assert data[0]["max(g:spans/messaging.message.receive.latency@millisecond)"] == 15.0

    def test_span_module_filter(self):
        self.store_span_metric(
            1,
            timestamp=self.min_ago,
            tags={"span.category": "db", "span.op": "db.redis"},
        )
        self.store_span_metric(
            4,
            timestamp=self.min_ago,
            tags={"span.category": "cache"},
        )
        self.store_span_metric(
            4,
            timestamp=self.min_ago,
            tags={"span.category": "db", "span.op": "db.sql.room"},
        )
        self.store_span_metric(
            2,
            timestamp=self.min_ago,
            tags={"span.category": "db"},
        )
        self.store_span_metric(
            3,
            timestamp=self.min_ago,
            tags={"span.category": "http"},
        )

        response = self.do_request(
            {
                "field": [
                    "span.description",
                    "span.module",
                    "avg(span.self_time)",
                ],
                "orderby": "avg(span.self_time)",
                "query": "span.module:[db, cache, other]",
                "project": self.project.id,
                "dataset": "metrics",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3

        assert data[0]["span.module"] == "db"
        assert data[0]["avg(span.self_time)"] == 2
        assert data[1]["span.module"] == "cache"
        assert data[1]["avg(span.self_time)"] == 2.5
        assert data[2]["span.module"] == "other"
        assert data[2]["avg(span.self_time)"] == 4


class OrganizationEventsMetricsEnhancedPerformanceEndpointTestWithOnDemandMetrics(
    MetricsEnhancedPerformanceTestCase
):
    viewname = "sentry-api-0-organization-events"

    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(
            self.viewname, kwargs={"organization_id_or_slug": self.organization.slug}
        )
        self.features = {"organizations:on-demand-metrics-extraction-widgets": True}

    def _create_specs(
        self, params: dict[str, Any], groupbys: list[str] | None = None
    ) -> list[OnDemandMetricSpec]:
        """Creates all specs based on the parameters that would be passed to the endpoint."""
        specs = []
        for field in params["field"]:
            spec = OnDemandMetricSpec(
                field=field,
                query=params["query"],
                environment=params.get("environment"),
                groupbys=groupbys,
                spec_type=MetricSpecType.DYNAMIC_QUERY,
            )
            specs.append(spec)
        return specs

    def _make_on_demand_request(
        self, params: dict[str, Any], extra_features: dict[str, bool] | None = None
    ) -> Response:
        """Ensures that the required parameters for an on-demand request are included."""
        # Expected parameters for this helper function
        params["dataset"] = "metricsEnhanced"
        params["useOnDemandMetrics"] = "true"
        params["onDemandType"] = "dynamic_query"
        _features = {**self.features, **(extra_features or {})}
        return self.do_request(params, features=_features)

    def _assert_on_demand_response(
        self,
        response: Response,
        expected_on_demand_query: bool | None = True,
        expected_dataset: str | None = "metricsEnhanced",
    ) -> None:
        """Basic assertions for an on-demand request."""
        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        assert meta.get("isMetricsExtractedData", False) is expected_on_demand_query
        assert meta["dataset"] == expected_dataset

    def test_is_metrics_extracted_data_is_included(self) -> None:
        params = {"field": ["count()"], "query": "transaction.duration:>=91", "yAxis": "count()"}
        specs = self._create_specs(params)
        for spec in specs:
            self.store_on_demand_metric(1, spec=spec)
        response = self._make_on_demand_request(params)
        self._assert_on_demand_response(response)

    def test_on_demand_user_misery(self) -> None:
        user_misery_field = "user_misery(300)"
        query = "transaction.duration:>=100"

        # We store data for both specs, however, when the query builders try to query
        # for the data it will not query on-demand data
        for spec_version in OnDemandMetricSpecVersioning.get_spec_versions():
            spec = OnDemandMetricSpec(
                field=user_misery_field,
                query=query,
                spec_type=MetricSpecType.DYNAMIC_QUERY,
                # We only allow querying the function in the latest spec version,
                # otherwise, the data returned by the endpoint would be 0.05
                spec_version=spec_version,
            )
            tags = {"satisfaction": "miserable"}
            self.store_on_demand_metric(1, spec=spec, additional_tags=tags, timestamp=self.min_ago)
            self.store_on_demand_metric(2, spec=spec, timestamp=self.min_ago)

        params = {"field": [user_misery_field], "project": self.project.id, "query": query}
        self._create_specs(params)

        # We expect it to be False because we're not using the extra feature flag
        response = self._make_on_demand_request(params)
        self._assert_on_demand_response(response, expected_on_demand_query=False)

        # Since we're using the extra feature flag we expect user_misery to be an on-demand metric
        response = self._make_on_demand_request(params, {SPEC_VERSION_TWO_FLAG: True})
        self._assert_on_demand_response(response, expected_on_demand_query=True)
        assert response.data["data"] == [{user_misery_field: user_misery_formula(1, 2)}]

    def test_on_demand_user_misery_discover_split_with_widget_id_unsaved(self) -> None:
        user_misery_field = "user_misery(300)"
        query = "transaction.duration:>=100"

        _, widget, __ = create_widget(["count()"], "", self.project, discover_widget_split=None)

        # We store data for both specs, however, when the query builders try to query
        # for the data it will not query on-demand data
        for spec_version in OnDemandMetricSpecVersioning.get_spec_versions():
            spec = OnDemandMetricSpec(
                field=user_misery_field,
                query=query,
                spec_type=MetricSpecType.DYNAMIC_QUERY,
                # We only allow querying the function in the latest spec version,
                # otherwise, the data returned by the endpoint would be 0.05
                spec_version=spec_version,
            )
            tags = {"satisfaction": "miserable"}
            self.store_on_demand_metric(1, spec=spec, additional_tags=tags, timestamp=self.min_ago)
            self.store_on_demand_metric(2, spec=spec, timestamp=self.min_ago)

        params = {"field": [user_misery_field], "project": self.project.id, "query": query}
        self._create_specs(params)

        params["dashboardWidgetId"] = widget.id

        # Since we're using the extra feature flag we expect user_misery to be an on-demand metric
        with mock.patch.object(widget, "save") as mock_widget_save:
            response = self._make_on_demand_request(params, {SPEC_VERSION_TWO_FLAG: True})
            assert bool(mock_widget_save.assert_called_once)

        self._assert_on_demand_response(response, expected_on_demand_query=True)
        assert response.data["data"] == [{user_misery_field: user_misery_formula(1, 2)}]

    def test_on_demand_user_misery_discover_split_with_widget_id_saved(self) -> None:
        user_misery_field = "user_misery(300)"
        query = "transaction.duration:>=100"

        _, widget, __ = create_widget(
            ["count()"],
            "",
            self.project,
            discover_widget_split=DashboardWidgetTypes.TRANSACTION_LIKE,  # Transactions like uses on-demand
        )

        # We store data for both specs, however, when the query builders try to query
        # for the data it will not query on-demand data
        for spec_version in OnDemandMetricSpecVersioning.get_spec_versions():
            spec = OnDemandMetricSpec(
                field=user_misery_field,
                query=query,
                spec_type=MetricSpecType.DYNAMIC_QUERY,
                # We only allow querying the function in the latest spec version,
                # otherwise, the data returned by the endpoint would be 0.05
                spec_version=spec_version,
            )
            tags = {"satisfaction": "miserable"}
            self.store_on_demand_metric(1, spec=spec, additional_tags=tags, timestamp=self.min_ago)
            self.store_on_demand_metric(2, spec=spec, timestamp=self.min_ago)

        params = {"field": [user_misery_field], "project": self.project.id, "query": query}
        self._create_specs(params)

        params["dashboardWidgetId"] = widget.id

        # Since we're using the extra feature flag we expect user_misery to be an on-demand metric
        with mock.patch.object(widget, "save") as mock_widget_save:
            response = self._make_on_demand_request(params, {SPEC_VERSION_TWO_FLAG: True})
            assert bool(mock_widget_save.assert_not_called)

        self._assert_on_demand_response(response, expected_on_demand_query=True)
        assert response.data["data"] == [{user_misery_field: user_misery_formula(1, 2)}]

    def test_on_demand_count_unique(self):
        field = "count_unique(user)"
        query = "transaction.duration:>0"
        params = {"field": [field], "query": query}
        # We do not really have to create the metrics for both specs since
        # the first API call will not query any on-demand metric
        for spec_version in OnDemandMetricSpecVersioning.get_spec_versions():
            spec = OnDemandMetricSpec(
                field=field,
                query=query,
                spec_type=MetricSpecType.DYNAMIC_QUERY,
                spec_version=spec_version,
            )
            self.store_on_demand_metric(1, spec=spec, timestamp=self.min_ago)
            self.store_on_demand_metric(2, spec=spec, timestamp=self.min_ago)

        # The first call will not be on-demand
        response = self._make_on_demand_request(params)
        self._assert_on_demand_response(response, expected_on_demand_query=False)

        # This second call will be on-demand
        response = self._make_on_demand_request(
            params, extra_features={SPEC_VERSION_TWO_FLAG: True}
        )
        self._assert_on_demand_response(response, expected_on_demand_query=True)
        assert response.data["data"] == [{"count_unique(user)": 2}]

    def test_split_decision_for_errors_widget(self):
        error_data = load_data("python", timestamp=before_now(minutes=1))
        self.store_event(
            data={
                **error_data,
                "exception": {"values": [{"type": "blah", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )
        _, widget, __ = create_widget(
            ["count()", "error.type"], "error.type:blah", self.project, discover_widget_split=None
        )

        response = self.do_request(
            {
                "field": ["count()", "error.type"],
                "query": "error.type:blah",
                "dataset": "metricsEnhanced",
                "per_page": 50,
                "dashboardWidgetId": widget.id,
            }
        )

        assert response.status_code == 200, response.content
        assert response.data.get("meta").get(
            "discoverSplitDecision"
        ) is DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.ERROR_EVENTS)

        widget.refresh_from_db()
        assert widget.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS
        assert widget.dataset_source == DatasetSourcesTypes.INFERRED.value

    def test_split_decision_for_transactions_widget(self):
        transaction_data = load_data("transaction", timestamp=before_now(minutes=1))
        self.store_event(
            data={
                **transaction_data,
            },
            project_id=self.project.id,
        )
        _, widget, __ = create_widget(
            ["count()", "transaction.name"], "", self.project, discover_widget_split=None
        )

        assert widget.discover_widget_split is None

        response = self.do_request(
            {
                "field": ["count()", "transaction.name"],
                "query": "",
                "dataset": "metricsEnhanced",
                "per_page": 50,
                "dashboardWidgetId": widget.id,
            }
        )

        assert response.status_code == 200, response.content
        assert response.data.get("meta").get(
            "discoverSplitDecision"
        ) is DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.TRANSACTION_LIKE)

        widget.refresh_from_db()
        assert widget.discover_widget_split == DashboardWidgetTypes.TRANSACTION_LIKE
        assert widget.dataset_source == DatasetSourcesTypes.INFERRED.value

    def test_split_decision_for_ambiguous_widget_without_data(self):
        _, widget, __ = create_widget(
            ["count()", "transaction.name", "error.type"],
            "",
            self.project,
            discover_widget_split=None,
        )
        assert widget.discover_widget_split is None

        response = self.do_request(
            {
                "field": ["count()", "transaction.op", "error.type"],
                "query": "",
                "dataset": "metricsEnhanced",
                "per_page": 50,
                "dashboardWidgetId": widget.id,
            },
            features={"organizations:performance-discover-dataset-selector": True},
        )

        assert response.status_code == 200, response.content
        assert response.data.get("meta").get(
            "discoverSplitDecision"
        ) == DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.ERROR_EVENTS)

        widget.refresh_from_db()
        assert widget.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS
        assert widget.dataset_source == DatasetSourcesTypes.FORCED.value

    def test_split_decision_for_ambiguous_widget_with_data(self):
        # Store a transaction
        transaction_data = load_data("transaction", timestamp=before_now(minutes=1))
        self.store_event(
            data={
                **transaction_data,
            },
            project_id=self.project.id,
        )

        # Store an event
        error_data = load_data("python", timestamp=before_now(minutes=1))
        self.store_event(
            data={
                **error_data,
                "exception": {"values": [{"type": "blah", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        _, widget, __ = create_widget(
            ["count()"],
            "",
            self.project,
            discover_widget_split=None,
        )
        assert widget.discover_widget_split is None

        response = self.do_request(
            {
                "field": ["count()"],
                "query": "",
                "dataset": "metricsEnhanced",
                "per_page": 50,
                "dashboardWidgetId": widget.id,
            },
            features={"organizations:performance-discover-dataset-selector": True},
        )

        assert response.status_code == 200, response.content
        assert response.data.get("meta").get(
            "discoverSplitDecision"
        ) == DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.ERROR_EVENTS)

        widget.refresh_from_db()
        assert widget.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS
        assert widget.dataset_source == DatasetSourcesTypes.FORCED.value

    @mock.patch("sentry.snuba.errors.query")
    def test_errors_request_made_for_saved_error_dashboard_widget_type(self, mock_errors_query):
        mock_errors_query.return_value = {
            "data": [],
            "meta": {},
        }
        _, widget, __ = create_widget(
            ["count()"], "", self.project, discover_widget_split=DashboardWidgetTypes.ERROR_EVENTS
        )

        response = self.do_request(
            {
                "field": [
                    "count()",
                ],
                "query": "",
                "dataset": "metricsEnhanced",
                "per_page": 50,
                "dashboardWidgetId": widget.id,
            }
        )

        assert response.status_code == 200, response.content
        mock_errors_query.assert_called_once()

    @mock.patch("sentry.snuba.metrics_enhanced_performance.query")
    def test_metrics_enhanced_request_made_for_saved_transaction_like_dashboard_widget_type(
        self, mock_mep_query
    ):
        mock_mep_query.return_value = {
            "data": [],
            "meta": {},
        }
        _, widget, __ = create_widget(
            ["count()"],
            "",
            self.project,
            discover_widget_split=DashboardWidgetTypes.TRANSACTION_LIKE,
        )

        response = self.do_request(
            {
                "field": [
                    "count()",
                ],
                "query": "",
                "dataset": "metricsEnhanced",
                "per_page": 50,
                "dashboardWidgetId": widget.id,
            }
        )

        assert response.status_code == 200, response.content
        mock_mep_query.assert_called_once()


class OrganizationEventsMetricsEnhancedPerformanceEndpointTestWithMetricLayer(
    OrganizationEventsMetricsEnhancedPerformanceEndpointTest
):
    def setUp(self):
        super().setUp()
        self.features["organizations:use-metrics-layer"] = True

    @pytest.mark.xfail(reason="Not supported")
    def test_time_spent(self):
        super().test_time_spent()

    @pytest.mark.xfail(reason="Not supported")
    def test_http_error_rate(self):
        super().test_http_error_rate()

    @pytest.mark.xfail(reason="Multiple aliases to same column not supported")
    def test_title_and_transaction_alias(self):
        super().test_title_and_transaction_alias()

    @pytest.mark.xfail(reason="Sort order is flaking when querying multiple datasets")
    def test_maintain_sort_order_across_datasets(self):
        """You may need to run this test a few times to get it to fail"""
        super().test_maintain_sort_order_across_datasets()

    @pytest.mark.xfail(reason="Not implemented")
    def test_avg_compare(self):
        super().test_avg_compare()

    @pytest.mark.xfail(reason="Not implemented")
    def test_avg_if(self):
        super().test_avg_if()

    @pytest.mark.xfail(reason="Not implemented")
    def test_count_if(self):
        super().test_count_if()

    @pytest.mark.xfail(reason="Not implemented")
    def test_device_class(self):
        super().test_device_class()

    @pytest.mark.xfail(reason="Not implemented")
    def test_device_class_filter(self):
        super().test_device_class_filter()

    @pytest.mark.xfail(reason="Not implemented")
    def test_performance_score(self):
        super().test_performance_score()

    @pytest.mark.xfail(reason="Not implemented")
    def test_performance_score_boundaries(self):
        super().test_performance_score_boundaries()

    @pytest.mark.xfail(reason="Not implemented")
    def test_total_performance_score(self):
        super().test_total_performance_score()

    @pytest.mark.xfail(reason="Not implemented")
    def test_total_performance_score_with_missing_vitals(self):
        super().test_total_performance_score_with_missing_vitals()

    @pytest.mark.xfail(reason="Not implemented")
    def test_invalid_performance_score_column(self):
        super().test_invalid_performance_score_column()

    @pytest.mark.xfail(reason="Not implemented")
    def test_opportunity_score(self):
        super().test_opportunity_score()

    @pytest.mark.xfail(reason="Not implemented")
    def test_opportunity_score_with_fixed_weights(self):
        super().test_opportunity_score_with_fixed_weights()

    @pytest.mark.xfail(reason="Not implemented")
    def test_opportunity_score_with_fixed_weights_and_missing_vitals(self):
        super().test_opportunity_score_with_fixed_weights_and_missing_vitals()

    @pytest.mark.xfail(reason="Not implemented")
    def test_count_scores(self):
        super().test_count_scores()

    @pytest.mark.xfail(reason="Not implemented")
    def test_count_starts(self):
        super().test_count_starts()

    @pytest.mark.xfail(reason="Not implemented")
    def test_count_starts_returns_all_counts_when_no_arg_is_passed(self):
        super().test_count_starts_returns_all_counts_when_no_arg_is_passed()

    @pytest.mark.xfail(reason="Not implemented")
    def test_timestamp_groupby(self):
        super().test_timestamp_groupby()

    @pytest.mark.xfail(reason="Not implemented")
    def test_on_demand_with_mep(self):
        super().test_on_demand_with_mep()

    @pytest.mark.xfail(reason="Not implemented")
    def test_cache_miss_rate(self):
        super().test_cache_miss_rate()

    @pytest.mark.xfail(reason="Not implemented")
    def test_http_response_rate(self):
        super().test_http_response_rate()

    @pytest.mark.xfail(reason="Not implemented")
    def test_avg_span_self_time(self):
        super().test_avg_span_self_time()

    @pytest.mark.xfail(reason="Not implemented")
    def test_avg_message_receive_latency_gauge_functions(self):
        super().test_avg_message_receive_latency_gauge_functions()

    @pytest.mark.xfail(reason="Not implemented")
    def test_span_module_filter(self):
        super().test_span_module_filter()
