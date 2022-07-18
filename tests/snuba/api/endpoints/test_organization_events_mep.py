from unittest import mock

from django.urls import reverse
from snuba_sdk.conditions import InvalidConditionError

from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models import ProjectTeam
from sentry.search.events import constants
from sentry.testutils import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data


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
            response.data["detail"] == "dataset must be one of: discover, metricsEnhanced, metrics"
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
        self.store_metric(
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
        assert field_meta["epm()"] == "number"

    def test_title_alias(self):
        """title is an alias to transaction name"""
        self.store_metric(
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
        self.store_metric(
            1,
            tags={"environment": "staging", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
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
        self.store_metric(
            1,
            tags={"environment": "staging", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
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
        self.store_metric(
            1,
            tags={"environment": "staging", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
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
        self.store_metric(
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
        self.store_metric(
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
        self.store_metric(
            1,
            tags={
                "transaction": "foo_transaction",
                constants.METRIC_SATISFACTION_TAG_KEY: constants.METRIC_SATISFIED_TAG_VALUE,
            },
            timestamp=self.min_ago,
        )
        self.store_metric(
            1,
            "measurements.fcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
            2,
            "measurements.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
            3,
            "measurements.fid",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
            4,
            "measurements.cls",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
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
                    ],
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

            assert meta["isMetricsData"]
            assert field_meta["transaction"] == "string"
            assert field_meta["project"] == "string"
            assert field_meta["p75(measurements.fcp)"] == "duration"
            assert field_meta["p75(measurements.lcp)"] == "duration"
            assert field_meta["p75(measurements.fid)"] == "duration"
            assert field_meta["p75(measurements.cls)"] == "duration"
            assert field_meta["apdex()"] == "number"
            assert field_meta["count_miserable(user)"] == "integer"
            assert field_meta["user_misery()"] == "number"

    def test_no_team_key_transactions(self):
        self.store_metric(1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago)
        self.store_metric(100, tags={"transaction": "bar_transaction"}, timestamp=self.min_ago)

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
        self.store_metric(100, tags={"transaction": "bar_transaction"}, timestamp=self.min_ago)

        for team, transaction in key_transactions:
            self.store_metric(1, tags={"transaction": transaction}, timestamp=self.min_ago)
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
        self.store_metric(100, tags={"transaction": "bar_transaction"}, timestamp=self.min_ago)

        for team, transaction, value in key_transactions:
            self.store_metric(value, tags={"transaction": transaction}, timestamp=self.min_ago)
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
        self.store_metric(100, tags={"transaction": "bar_transaction"}, timestamp=self.min_ago)

        for team, transaction, value in key_transactions:
            self.store_metric(value, tags={"transaction": transaction}, timestamp=self.min_ago)
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
                self.store_metric(
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
        self.store_metric(
            50,
            metric="measurements.lcp",
            tags={"measurement_rating": "good", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
            15,
            metric="measurements.fp",
            tags={"measurement_rating": "good", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
            1500,
            metric="measurements.fcp",
            tags={"measurement_rating": "meh", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
            125,
            metric="measurements.fid",
            tags={"measurement_rating": "meh", "transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
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

        assert meta["isMetricsData"]
        assert field_meta["count_web_vitals(measurements.lcp, good)"] == "integer"
        assert field_meta["count_web_vitals(measurements.fp, good)"] == "integer"
        assert field_meta["count_web_vitals(measurements.fcp, meh)"] == "integer"
        assert field_meta["count_web_vitals(measurements.fid, meh)"] == "integer"
        assert field_meta["count_web_vitals(measurements.cls, good)"] == "integer"

    def test_measurement_rating_that_does_not_exist(self):
        self.store_metric(
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

    @mock.patch("sentry.snuba.metrics_performance.MetricsQueryBuilder")
    def test_failed_dry_run_does_not_error(self, mock_builder):
        with self.feature("organizations:performance-dry-run-mep"):
            mock_builder.side_effect = InvalidSearchQuery("Something bad")
            query = {
                "field": ["count()"],
                "project": [self.project.id],
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(mock_builder.mock_calls) == 1
            assert mock_builder.call_args.kwargs["dry_run"]

            mock_builder.side_effect = IncompatibleMetricsQuery("Something bad")
            query = {
                "field": ["count()"],
                "project": [self.project.id],
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(mock_builder.mock_calls) == 2
            assert mock_builder.call_args.kwargs["dry_run"]

            mock_builder.side_effect = InvalidConditionError("Something bad")
            query = {
                "field": ["count()"],
                "project": [self.project.id],
            }
            response = self.do_request(query)
            assert response.status_code == 200, response.content
            assert len(mock_builder.mock_calls) == 3
            assert mock_builder.call_args.kwargs["dry_run"]

    def test_count_unique_user_returns_zero(self):
        self.store_metric(
            50,
            metric="user",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
            50,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
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
        self.store_metric(
            50,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        self.store_metric(
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
        self.store_metric(
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

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        meta = response.data["meta"]

        assert data[0]["transaction"] == "foo_transaction"
        assert data[0]["p50(measurements.something_custom)"] == 1
        assert meta["isMetricsData"]
