from datetime import timedelta

from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsStatsOurlogsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.end = self.start + timedelta(hours=6)
        self.two_days_ago = self.day_ago - timedelta(days=1)

        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:ourlogs": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_count(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        logs = []
        for hour, count in enumerate(event_counts):
            logs.extend(
                [
                    self.create_ourlog(
                        {"body": "foo"},
                        timestamp=self.start + timedelta(hours=hour, minutes=minute),
                        attributes={"status": {"string_value": "success"}},
                    )
                    for minute in range(count)
                ],
            )
        self.store_ourlogs(logs)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "ourlogs",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": count}] for count in event_counts
        ]

    def test_zerofill(self):
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "ourlogs",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 0}]] * 7

    def test_homepage_query(self):
        """This query matches the one made on the logs homepage so that we can be sure everything is working at least
        for the initial load"""
        response = self._do_request(
            data={
                "dataset": "ourlogs",
                "excludeOther": 0,
                "field": ["count(message)"],
                "interval": "1h",
                "orderby": "-count_message",
                "partial": 1,
                "per_page": 50,
                "project": self.project.id,
                "query": f"tags[sentry.timestamp_precise,number]:<={self.start.timestamp() * 1000000}",
                "referrer": "explore.ourlogs.main-chart",
                "sort": "-count_message",
                "statsPeriod": "14d",
                "yAxis": "count(message)",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 0}]] * 338
