from datetime import timedelta

from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsStatsOurlogsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-stats"

    def setUp(self) -> None:
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

    def test_count(self) -> None:
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
                "dataset": "logs",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": count}] for count in event_counts
        ]

    def test_zerofill(self) -> None:
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "logs",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 0}]] * 7

    def test_homepage_query(self) -> None:
        """This query matches the one made on the logs homepage so that we can be sure everything is working at least
        for the initial load"""
        response = self._do_request(
            data={
                "dataset": "logs",
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

    def test_top_events(self) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        logs = [
            self.create_ourlog(
                {"body": "baz"},
                timestamp=self.start + timedelta(hours=1),
                attributes={"status": {"string_value": "success"}},
            )
        ]
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
            logs.extend(
                [
                    self.create_ourlog(
                        {"body": "bar"},
                        timestamp=self.start + timedelta(hours=hour, minutes=minute),
                        attributes={"status": {"string_value": "success"}},
                    )
                    for minute in range(count)
                ],
            )
        self.store_ourlogs(logs)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "field": ["message", "count(message)"],
                "orderby": ["-count_message"],
                "project": self.project.id,
                "dataset": "logs",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" in response.data
        assert "foo" in response.data
        assert "bar" in response.data

        for key in ["foo", "bar"]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip(event_counts, rows):
                assert result[1][0]["count"] == expected, key

            assert response.data[key]["meta"]["dataset"] == "logs"

        rows = response.data["Other"]["data"][0:6]
        for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
            assert result[1][0]["count"] == expected, "Other"

    def test_top_events_empty_other(self) -> None:
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
            logs.extend(
                [
                    self.create_ourlog(
                        {"body": "bar"},
                        timestamp=self.start + timedelta(hours=hour, minutes=minute),
                        attributes={"status": {"string_value": "success"}},
                    )
                    for minute in range(count)
                ],
            )
        self.store_ourlogs(logs)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "field": ["message", "count(message)"],
                "orderby": ["-count_message"],
                "project": self.project.id,
                "dataset": "logs",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" not in response.data
        assert "foo" in response.data
        assert "bar" in response.data

        for key in ["foo", "bar"]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip(event_counts, rows):
                assert result[1][0]["count"] == expected, key

            assert response.data[key]["meta"]["dataset"] == "logs"

    def test_top_events_multi_y_axis(self) -> None:
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": message},
                    attributes={"user": "foo"},
                    timestamp=self.day_ago + timedelta(minutes=1),
                )
                for message in ["foo", "bar", "baz"]
            ],
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": ["count()", "count_unique(user)"],
                "field": ["message", "count()"],
                "orderby": ["message"],
                "project": self.project.id,
                "dataset": "logs",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content

        for key in ["Other", "bar", "baz"]:
            assert key in response.data
            for y_axis in ["count()", "count_unique(user)"]:
                assert y_axis in response.data[key]
                assert response.data[key][y_axis]["meta"]["dataset"] == "logs"
            counts = response.data[key]["count()"]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], counts):
                assert result[1][0]["count"] == expected, key
            uniqs = response.data[key]["count_unique(user)"]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], uniqs):
                assert result[1][0]["count"] == expected, key

    def test_top_events_with_project(self) -> None:
        projects = [self.create_project(), self.create_project()]
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo"},
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"status": {"string_value": "success"}},
                    project=project,
                )
                for project in projects
            ],
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "count()"],
                "orderby": ["-count"],
                "dataset": "logs",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" not in response.data
        assert projects[0].slug in response.data
        assert projects[1].slug in response.data
        for key in [projects[0].slug, projects[1].slug]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
                assert result[1][0]["count"] == expected, key
            assert response.data[key]["meta"]["dataset"] == "logs"

    def test_top_events_with_project_and_project_id(self) -> None:
        projects = [self.create_project(), self.create_project()]
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo"},
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"status": {"string_value": "success"}},
                    project=project,
                )
                for project in projects
            ],
        )

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "project.id", "count()"],
                "orderby": ["-count"],
                "dataset": "logs",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" not in response.data
        key1 = f"{projects[0].slug},{projects[0].id}"
        key2 = f"{projects[1].slug},{projects[1].id}"
        assert key1 in response.data
        assert key2 in response.data
        for key in [key1, key2]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
                assert result[1][0]["count"] == expected, key
            assert response.data[key]["meta"]["dataset"] == "logs"

    def test_top_events_with_no_data(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["project", "count()"],
                "orderby": ["-count"],
                "dataset": "logs",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
