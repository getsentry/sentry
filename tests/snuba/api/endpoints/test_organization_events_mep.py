from __future__ import annotations

from typing import Any, Optional
from unittest import mock

import pytest
from django.urls import reverse
from rest_framework.response import Response

from sentry.api.bases.organization_events import DATASET_OPTIONS
from sentry.discover.models import TeamKeyTransaction
from sentry.models.projectteam import ProjectTeam
from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events import constants
from sentry.search.utils import map_device_class_level
from sentry.snuba.metrics.extraction import MetricSpecType, OnDemandMetricSpec
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.metrics.naming_layer.public import TransactionMetricKey
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
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
        self.min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)
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
            kwargs={"organization_slug": self.organization.slug},
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
                "start": iso_format(before_now(days=20)),
                "end": iso_format(before_now(days=15)),
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
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.lcp",
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
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.00,
            metric="measurements.score.weight.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.00,
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
            1.00,
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

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "performance_score(measurements.score.lcp)",
                    "performance_score(measurements.score.fcp)",
                    "performance_score(measurements.score.fid)",
                    "performance_score(measurements.score.ttfb)",
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

        assert data[0]["performance_score(measurements.score.lcp)"] == 0.7923076923076923
        assert data[0]["performance_score(measurements.score.fcp)"] == 0.5
        assert data[0]["performance_score(measurements.score.fid)"] == 0
        assert data[0]["performance_score(measurements.score.ttfb)"] == 0

        assert meta["isMetricsData"]
        assert field_meta["performance_score(measurements.score.lcp)"] == "number"

    def test_performance_score_boundaries(self):
        # Scores shouldn't exceed 1 or go below 0, but we can test these boundaries anyways
        self.store_transaction_metric(
            0.65,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.lcp",
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
                    "performance_score(measurements.score.lcp)",
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

        assert data[0]["performance_score(measurements.score.lcp)"] == 1.0
        assert data[0]["performance_score(measurements.score.fcp)"] == 0.0

        assert meta["isMetricsData"]
        assert field_meta["performance_score(measurements.score.lcp)"] == "number"

    def test_weighted_performance_score(self):
        self.store_transaction_metric(
            0.03,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.03,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        self.store_transaction_metric(
            1.00,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.00,
            metric="measurements.score.weight.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.00,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.00,
            metric="measurements.score.total",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "weighted_performance_score(measurements.score.lcp)",
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

        assert data[0]["weighted_performance_score(measurements.score.lcp)"] == 0.3433333333333333
        assert meta["isMetricsData"]
        assert field_meta["weighted_performance_score(measurements.score.lcp)"] == "number"

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

    def test_invalid_weighted_performance_score_column(self):
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
                    "weighted_performance_score(measurements.score.fp)",
                ],
                "query": "event.type:transaction",
                "dataset": "metrics",
                "per_page": 50,
            }
        )
        assert response.status_code == 400, response.content

    def test_no_weighted_performance_score_column(self):
        self.store_transaction_metric(
            0.0,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "weighted_performance_score(measurements.score.lcp)",
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

        assert data[0]["weighted_performance_score(measurements.score.lcp)"] == 0.0
        assert meta["isMetricsData"]
        assert field_meta["weighted_performance_score(measurements.score.lcp)"] == "number"

    def test_opportunity_score(self):
        self.store_transaction_metric(
            0.03,
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            0.30,
            metric="measurements.score.weight.lcp",
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
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_transaction_metric(
            1.0,
            metric="measurements.score.weight.lcp",
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

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "opportunity_score(measurements.score.lcp)",
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

        assert data[0]["opportunity_score(measurements.score.lcp)"] == 0.27
        assert data[0]["opportunity_score(measurements.score.total)"] == 1.57

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
            metric="measurements.score.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "count_scores(measurements.score.total)",
                    "count_scores(measurements.score.lcp)",
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
        assert data[0]["count_scores(measurements.score.lcp)"] == 1

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


class OrganizationEventsMetricsEnhancedPerformanceEndpointTestWithOnDemandMetrics(
    MetricsEnhancedPerformanceTestCase
):
    viewname = "sentry-api-0-organization-events"

    def setUp(self) -> None:
        super().setUp()

    def do_request(self, query: Any) -> Any:
        self.login_as(user=self.user)
        url = reverse(
            self.viewname,
            kwargs={"organization_slug": self.organization.slug},
        )
        with self.feature({"organizations:on-demand-metrics-extraction-widgets": True}):
            return self.client.get(url, query, format="json")

    def _on_demand_query_check(
        self,
        params: dict[str, Any],
        groupbys: Optional[list[str]] = None,
        expected_on_demand_query: Optional[bool] = True,
        expected_dataset: Optional[str] = "metricsEnhanced",
    ) -> Response:
        """Do a request to the events endpoint with metrics enhanced and on-demand enabled."""
        for field in params["field"]:
            spec = OnDemandMetricSpec(
                field=field,
                query=params["query"],
                environment=params.get("environment"),
                groupbys=groupbys,
                spec_type=MetricSpecType.DYNAMIC_QUERY,
            )
        # Expected parameters for this helper function
        params["dataset"] = "metricsEnhanced"
        params["useOnDemandMetrics"] = "true"
        params["onDemandType"] = "dynamic_query"

        self.store_on_demand_metric(1, spec=spec)
        response = self.do_request(params)

        assert response.status_code == 200, response.content
        meta = response.data["meta"]
        assert meta.get("isMetricsExtractedData", False) is expected_on_demand_query
        assert meta["dataset"] == expected_dataset

        return response

    def test_is_metrics_extracted_data_is_included(self) -> None:
        self._on_demand_query_check(
            {"field": ["count()"], "query": "transaction.duration:>=91", "yAxis": "count()"}
        )

    def test_transaction_user_misery(self) -> None:
        resp = self._on_demand_query_check(
            {
                "field": ["user_misery(300)", "apdex(300)"],
                "project": self.project.id,
                "query": "",
                "sort": "-user_misery(300)",
                "per_page": "20",
                "referrer": "api.dashboards.tablewidget",
            },
            groupbys=["transaction"],
        )
        assert resp.data == {
            "data": [{"user_misery(300)": 0.0, "apdex(300)": 0.0}],
            "meta": {
                "fields": {"user_misery(300)": "number", "apdex(300)": "number"},
                "units": {"user_misery(300)": None, "apdex(300)": None},
                "isMetricsData": True,
                "isMetricsExtractedData": True,
                "tips": {},
                "datasetReason": "unchanged",
                "dataset": "metricsEnhanced",
            },
        }


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
        super().test_performance_score()

    @pytest.mark.xfail(reason="Not implemented")
    def test_weighted_performance_score(self):
        super().test_weighted_performance_score()

    @pytest.mark.xfail(reason="Not implemented")
    def test_invalid_performance_score_column(self):
        super().test_invalid_performance_score_column()

    @pytest.mark.xfail(reason="Not implemented")
    def test_invalid_weighted_performance_score_column(self):
        super().test_invalid_weighted_performance_score_column()

    @pytest.mark.xfail(reason="Not implemented")
    def test_no_weighted_performance_score_column(self):
        super().test_invalid_weighted_performance_score_column()

    @pytest.mark.xfail(reason="Not implemented")
    def test_opportunity_score(self):
        super().test_opportunity_score()

    @pytest.mark.xfail(reason="Not implemented")
    def test_count_scores(self):
        super().test_count_scores()

    @pytest.mark.xfail(reason="Not implemented")
    def test_count_starts(self):
        super().test_count_starts()

    @pytest.mark.xfail(reason="Not implemented")
    def test_timestamp_groupby(self):
        super().test_timestamp_groupby()
