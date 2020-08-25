from __future__ import absolute_import

from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.utils.samples import load_data
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsTrendsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsTrendsEndpointTest, self).setUp()
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()
        self.prototype = load_data("transaction")
        data = self.prototype.copy()
        data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=30))
        data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=30, seconds=1))
        self.store_event(data, project_id=self.project.id)

        second = [0, 2, 10]
        for i in range(3):
            data = self.prototype.copy()
            data["start_timestamp"] = iso_format(self.day_ago + timedelta(hours=1, minutes=30))
            data["timestamp"] = iso_format(
                self.day_ago + timedelta(hours=1, minutes=30, seconds=second[i])
            )
            data["user"] = {"email": "foo{}@example.com".format(i)}
            self.store_event(data, project_id=self.project.id)

    def test_simple(self):
        with self.feature("organizations:internal-catchall"):
            url = reverse(
                "sentry-api-0-organization-events-trends",
                kwargs={"organization_slug": self.project.organization.slug},
            )
            response = self.client.get(
                url,
                format="json",
                data={
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "start": iso_format(self.day_ago),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        assert events["data"][0] == {
            "count_range_1": 1,
            "count_range_2": 3,
            "transaction": self.prototype["transaction"],
            "project": self.project.slug,
            "percentile_range_1": 1000,
            "percentile_range_2": 2000,
            "divide_count_range_2_count_range_1": 3.0,
            "minus_percentile_range_2_percentile_range_1": 1000.0,
            "divide_percentile_range_2_percentile_range_1": 2.0,
        }

        stats = result_stats["{},{}".format(self.project.slug, self.prototype["transaction"])]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 1000}],
            [{"count": 2000}],
        ]

    def test_avg_trend_function(self):
        with self.feature("organizations:internal-catchall"):
            url = reverse(
                "sentry-api-0-organization-events-trends",
                kwargs={"organization_slug": self.project.organization.slug},
            )
            response = self.client.get(
                url,
                format="json",
                data={
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "start": iso_format(self.day_ago),
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
        assert events["data"][0] == {
            "count_range_2": 3,
            "count_range_1": 1,
            "transaction": self.prototype["transaction"],
            "project": self.project.slug,
            "avg_range_1": 1000,
            "avg_range_2": 4000,
            "divide_count_range_2_count_range_1": 3.0,
            "minus_avg_range_2_avg_range_1": 3000.0,
            "divide_avg_range_2_avg_range_1": 4.0,
        }

        stats = result_stats["{},{}".format(self.project.slug, self.prototype["transaction"])]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 1000}],
            [{"count": 4000}],
        ]

    def test_misery_trend_function(self):
        with self.feature("organizations:internal-catchall"):
            url = reverse(
                "sentry-api-0-organization-events-trends",
                kwargs={"organization_slug": self.project.organization.slug},
            )
            response = self.client.get(
                url,
                format="json",
                data={
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "start": iso_format(self.day_ago),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "user_misery(300)",
                    "project": [self.project.id],
                },
            )
        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        assert events["data"][0] == {
            "count_range_2": 3,
            "count_range_1": 1,
            "transaction": self.prototype["transaction"],
            "project": self.project.slug,
            "user_misery_range_1": 0,
            "user_misery_range_2": 2,
            "divide_count_range_2_count_range_1": 3.0,
            "minus_user_misery_range_2_user_misery_range_1": 2.0,
            "divide_user_misery_range_2_user_misery_range_1": None,
        }

        stats = result_stats["{},{}".format(self.project.slug, self.prototype["transaction"])]
        assert [attrs for time, attrs in stats["data"]] == [
            [{"count": 0}],
            [{"count": 2}],
        ]

    def test_invalid_trend_function(self):
        with self.feature("organizations:internal-catchall"):
            url = reverse(
                "sentry-api-0-organization-events-trends",
                kwargs={"organization_slug": self.project.organization.slug},
            )
            response = self.client.get(
                url,
                format="json",
                data={
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "start": iso_format(self.day_ago),
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "trendFunction": "apdex(450)",
                    "project": [self.project.id],
                },
            )
            assert response.status_code == 400
