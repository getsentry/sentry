from datetime import timedelta

from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class OrganizationEventsTrendsBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.prototype = load_data("transaction")
        data = self.prototype.copy()
        data["start_timestamp"] = (self.day_ago + timedelta(minutes=30)).isoformat()
        data["user"] = {"email": "foo@example.com"}
        data["timestamp"] = (self.day_ago + timedelta(minutes=30, seconds=2)).isoformat()
        data["measurements"]["lcp"]["value"] = 2000
        self.store_event(data, project_id=self.project.id)

        second = [0, 2, 10]
        for i in range(3):
            data = self.prototype.copy()
            data["start_timestamp"] = (
                self.day_ago + timedelta(hours=1, minutes=30 + i)
            ).isoformat()
            data["timestamp"] = (
                self.day_ago + timedelta(hours=1, minutes=30 + i, seconds=second[i])
            ).isoformat()
            data["measurements"]["lcp"]["value"] = second[i] * 1000
            data["user"] = {"email": f"foo{i}@example.com"}
            self.store_event(data, project_id=self.project.id)

        self.expected_data = {
            "count_range_1": 1,
            "count_range_2": 3,
            "transaction": self.prototype["transaction"],
            "project": self.project.slug,
        }

    def assert_event(self, data):
        for key, value in self.expected_data.items():
            assert data[key] == value, key


class OrganizationEventsTrendsEndpointTest(OrganizationEventsTrendsBase):
    def setUp(self):
        super().setUp()
        self.url = reverse(
            "sentry-api-0-organization-events-trends",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        self.features = {"organizations:performance-view": True}

    def test_simple(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendType": "regression",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 2000,
                "count_percentage": 3.0,
                "trend_difference": 0.0,
                "trend_percentage": 1.0,
            }
        )
        self.assert_event(events["data"][0])

    def test_web_vital(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendType": "regression",
                    "trendFunction": "p50(measurements.lcp)",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1
        # LCP values are identical to duration
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 2000,
                "count_percentage": 3.0,
                "trend_difference": 0.0,
                "trend_percentage": 1.0,
            }
        )
        self.assert_event(events["data"][0])

    def test_p75(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "p75()",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 6000,
                "count_percentage": 3.0,
                "trend_difference": 4000.0,
                "trend_percentage": 3.0,
            }
        )
        self.assert_event(events["data"][0])

    def test_p95(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "p95()",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 9200,
                "count_percentage": 3.0,
                "trend_difference": 7200.0,
                "trend_percentage": 4.6,
            }
        )
        self.assert_event(events["data"][0])

    def test_p99(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "p99()",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 9840,
                "count_percentage": 3.0,
                "trend_difference": 7840.0,
                "trend_percentage": 4.92,
            }
        )
        self.assert_event(events["data"][0])

    def test_trend_percentage_query_alias(self):
        queries = [
            ("trend_percentage():>0%", "regression", 1),
            ("trend_percentage():392%", "regression", 1),
            ("trend_percentage():>0%", "improved", 0),
            ("trend_percentage():392%", "improved", 0),
        ]
        for query_data in queries:
            with self.feature(self.features):
                response = self.client.get(
                    self.url,
                    format="json",
                    data={
                        "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                        "start": self.day_ago.isoformat(),
                        "field": ["project", "transaction"],
                        "query": f"event.type:transaction {query_data[0]}",
                        "trendType": query_data[1],
                        # Use p99 since it has the most significant change
                        "trendFunction": "p99()",
                    },
                )

            assert response.status_code == 200, response.content

            events = response.data

            assert len(events["data"]) == query_data[2], query_data

    def test_trend_percentage_query_alias_as_sort(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendType": "improved",
                    "trendFunction": "p50()",
                    "sort": "trend_percentage()",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1

    def test_trend_difference_query_alias(self):
        queries = [
            ("trend_difference():>7s", "regression", 1),
            ("trend_difference():7.84s", "regression", 1),
            ("trend_difference():>7s", "improved", 0),
            ("trend_difference():7.84s", "improved", 0),
        ]
        for query_data in queries:
            with self.feature(self.features):
                response = self.client.get(
                    self.url,
                    format="json",
                    data={
                        "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                        "start": self.day_ago.isoformat(),
                        "field": ["project", "transaction"],
                        "query": f"event.type:transaction {query_data[0]}",
                        "trendType": query_data[1],
                        # Use p99 since it has the most significant change
                        "trendFunction": "p99()",
                    },
                )

            assert response.status_code == 200, response.content

            events = response.data

            assert len(events["data"]) == query_data[2], query_data

    def test_avg_trend_function(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "avg(transaction.duration)",
                    "project": [self.project.id],
                },
            )
        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 4000,
                "count_percentage": 3.0,
                "trend_difference": 2000.0,
                "trend_percentage": 2.0,
            }
        )
        self.assert_event(events["data"][0])

    def test_invalid_trend_function(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "apdex(450)",
                    "project": [self.project.id],
                },
            )
            assert response.status_code == 400

    def test_divide_by_zero(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    # Set the timeframe to where the second range has no transactions so all the counts/percentile are 0
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": (self.day_ago - timedelta(hours=2)).isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": [self.project.id],
                },
            )
        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "count_range_2": 4,
                "count_range_1": 0,
                "aggregate_range_1": 0,
                "aggregate_range_2": 2000.0,
                "count_percentage": None,
                "trend_difference": 0,
                "trend_percentage": None,
            }
        )
        self.assert_event(events["data"][0])

    def test_auto_aggregation(self):
        # absolute_correlation is automatically added, and not a part of data otherwise
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    # Set the timeframe to where the second range has no transactions so all the counts/percentile are 0
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": (self.day_ago - timedelta(hours=2)).isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction absolute_correlation():>0.2",
                    "project": [self.project.id],
                },
            )
        assert response.status_code == 200, response.content

        events = response.data

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "count_range_2": 4,
                "count_range_1": 0,
                "aggregate_range_1": 0,
                "aggregate_range_2": 2000.0,
                "count_percentage": None,
                "trend_difference": 0,
                "trend_percentage": None,
            }
        )
        self.assert_event(events["data"][0])


class OrganizationEventsTrendsStatsEndpointTest(OrganizationEventsTrendsBase):
    def setUp(self):
        super().setUp()
        self.url = reverse(
            "sentry-api-0-organization-events-trends-stats",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        self.features = {"organizations:performance-view": True}

    def test_simple(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 2000,
                "count_percentage": 3.0,
                "trend_difference": 0.0,
                "trend_percentage": 1.0,
            }
        )
        self.assert_event(events["data"][0])

        stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 2000}],
            [{"count": 2000}],
        ]

    def test_web_vital(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "p50(measurements.lcp)",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 2000,
                "count_percentage": 3.0,
                "trend_difference": 0.0,
                "trend_percentage": 1.0,
            }
        )
        self.assert_event(events["data"][0])

        stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 2000}],
            [{"count": 2000}],
        ]

    def test_p75(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "p75()",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 6000,
                "count_percentage": 3.0,
                "trend_difference": 4000.0,
                "trend_percentage": 3.0,
            }
        )
        self.assert_event(events["data"][0])

        stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 2000}],
            [{"count": 6000}],
        ]

    def test_p95(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "p95()",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 9200,
                "count_percentage": 3.0,
                "trend_difference": 7200.0,
                "trend_percentage": 4.6,
            }
        )
        self.assert_event(events["data"][0])

        stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 2000}],
            [{"count": 9200}],
        ]

    def test_p99(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "p99()",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 9840,
                "count_percentage": 3.0,
                "trend_difference": 7840.0,
                "trend_percentage": 4.92,
            }
        )
        self.assert_event(events["data"][0])

        stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 2000}],
            [{"count": 9840}],
        ]

    def test_avg_trend_function(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "avg(transaction.duration)",
                    "project": [self.project.id],
                },
            )
        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "aggregate_range_1": 2000,
                "aggregate_range_2": 4000,
                "count_percentage": 3.0,
                "trend_difference": 2000.0,
                "trend_percentage": 2.0,
            }
        )
        self.assert_event(events["data"][0])

        stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 2000}],
            [{"count": 4000}],
        ]

    def test_alias_in_conditions(self):
        query_parts = [
            "event.type:transaction",
            "count_percentage():>0.25",
            "count_percentage():<4",
            "trend_percentage():>0%",
        ]
        queries = [" ".join(query_parts), " AND ".join(query_parts)]
        for query in queries:
            with self.feature(self.features):
                response = self.client.get(
                    self.url,
                    format="json",
                    data={
                        "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                        "interval": "1h",
                        "start": self.day_ago.isoformat(),
                        "field": ["project", "transaction"],
                        "query": query,
                        "trendFunction": "avg(transaction.duration)",
                        "project": [self.project.id],
                    },
                )
            assert response.status_code == 200, response.content

            events = response.data["events"]
            result_stats = response.data["stats"]

            assert len(events["data"]) == 1
            self.expected_data.update(
                {
                    "aggregate_range_1": 2000,
                    "aggregate_range_2": 4000,
                    "count_percentage": 3.0,
                    "trend_difference": 2000.0,
                    "trend_percentage": 2.0,
                }
            )
            self.assert_event(events["data"][0])

            stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
            assert [attrs for time, attrs in stats["data"]] == [
                [{"count": 2000}],
                [{"count": 4000}],
            ]

    def test_trend_with_middle(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "middle": (self.day_ago + timedelta(hours=1, minutes=31)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "avg(transaction.duration)",
                    "project": [self.project.id],
                },
            )
        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "count_range_2": 2,
                "count_range_1": 2,
                "aggregate_range_1": 1000,
                "aggregate_range_2": 6000,
                "count_percentage": 1.0,
                "trend_difference": 5000.0,
                "trend_percentage": 6.0,
            }
        )
        self.assert_event(events["data"][0])

        stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 2000}],
            [{"count": 4000}],
        ]

    def test_invalid_middle_date(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": self.day_ago.isoformat(),
                    "middle": "blah",
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "p50()",
                    "project": [self.project.id],
                },
            )
            assert response.status_code == 400

            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": self.day_ago.isoformat(),
                    "middle": (self.day_ago - timedelta(hours=2)).isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "apdex(450)",
                    "project": [self.project.id],
                },
            )
            assert response.status_code == 400

            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": self.day_ago.isoformat(),
                    "middle": (self.day_ago + timedelta(hours=4)).isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "apdex(450)",
                    "project": [self.project.id],
                },
            )
            assert response.status_code == 400

    def test_invalid_trend_function(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": self.day_ago.isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "apdex(450)",
                    "project": [self.project.id],
                },
            )
            assert response.status_code == 400

    def test_divide_by_zero(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    # Set the timeframe to where the second range has no transactions so all the counts/percentile are 0
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": (self.day_ago - timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": [self.project.id],
                },
            )
        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        self.expected_data.update(
            {
                "count_range_2": 4,
                "count_range_1": 0,
                "aggregate_range_1": 0,
                "aggregate_range_2": 2000.0,
                "count_percentage": None,
                "trend_difference": 0,
                "trend_percentage": None,
            }
        )
        self.assert_event(events["data"][0])

        stats = result_stats[f"{self.project.slug},{self.prototype['transaction']}"]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 0}],
            [{"count": 0}],
            [{"count": 2000}],
            [{"count": 2000}],
        ]


class OrganizationEventsTrendsPagingTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-events-trends-stats",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.prototype = load_data("transaction")
        self.features = {"organizations:performance-view": True}

        # Make 10 transactions for paging
        for i in range(10):
            for j in range(2):
                data = self.prototype.copy()
                data["user"] = {"email": "foo@example.com"}
                data["start_timestamp"] = (self.day_ago + timedelta(minutes=30)).isoformat()
                data["timestamp"] = (
                    self.day_ago + timedelta(hours=j, minutes=30, seconds=2)
                ).isoformat()
                if i < 5:
                    data["transaction"] = f"transaction_1{i}"
                else:
                    data["transaction"] = f"transaction_2{i}"
                self.store_event(data, project_id=self.project.id)

    def _parse_links(self, header):
        # links come in {url: {...attrs}}, but we need {rel: {...attrs}}
        links = {}
        for url, attrs in parse_link_header(header).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url
        return links

    def test_pagination(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    # Set the timeframe to where the second range has no transactions so all the counts/percentile are 0
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": (self.day_ago - timedelta(hours=2)).isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": [self.project.id],
                },
            )
            assert response.status_code == 200, response.content

            links = self._parse_links(response["Link"])
            assert links["previous"]["results"] == "false"
            assert links["next"]["results"] == "true"
            assert len(response.data["events"]["data"]) == 5

            response = self.client.get(links["next"]["href"], format="json")
            assert response.status_code == 200, response.content

            links = self._parse_links(response["Link"])
            assert links["previous"]["results"] == "true"
            assert links["next"]["results"] == "false"
            assert len(response.data["events"]["data"]) == 5

    def test_pagination_with_query(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    # Set the timeframe to where the second range has no transactions so all the counts/percentile are 0
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "start": (self.day_ago - timedelta(hours=2)).isoformat(),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction transaction:transaction_1*",
                    "project": [self.project.id],
                },
            )
            assert response.status_code == 200, response.content

            links = self._parse_links(response["Link"])
            assert links["previous"]["results"] == "false"
            assert links["next"]["results"] == "false"
            assert len(response.data["events"]["data"]) == 5
