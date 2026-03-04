from datetime import timedelta

from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsStatsProcessingErrorsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-stats"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.end = self.start + timedelta(hours=6)

        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        if features is None:
            features = {}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_count(self) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        items = []
        for hour, count in enumerate(event_counts):
            items.extend(
                [
                    self.create_processing_error(
                        error_type="js_no_source",
                        timestamp=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        self.store_processing_errors(items)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "processing_errors",
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
                "dataset": "processing_errors",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 0}]] * 7

    def test_top_events_group_by_error_type(self) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        items = []
        for hour, count in enumerate(event_counts):
            items.extend(
                [
                    self.create_processing_error(
                        error_type="js_no_source",
                        timestamp=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
            items.extend(
                [
                    self.create_processing_error(
                        error_type="js_invalid_source",
                        timestamp=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ],
            )
        items.append(
            self.create_processing_error(
                error_type="js_scraping_disabled",
                timestamp=self.start + timedelta(hours=1),
            )
        )
        self.store_processing_errors(items)

        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": "count()",
                "field": ["error_type", "count()"],
                "orderby": ["-count"],
                "project": self.project.id,
                "dataset": "processing_errors",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
        assert "Other" in response.data
        assert "js_no_source" in response.data
        assert "js_invalid_source" in response.data

        for key in ["js_no_source", "js_invalid_source"]:
            rows = response.data[key]["data"][0:6]
            for expected, result in zip(event_counts, rows):
                assert result[1][0]["count"] == expected, key

            assert response.data[key]["meta"]["dataset"] == "processing_errors"

        rows = response.data["Other"]["data"][0:6]
        for expected, result in zip([0, 1, 0, 0, 0, 0], rows):
            assert result[1][0]["count"] == expected, "Other"

    def test_filter_by_error_type(self) -> None:
        items = [
            self.create_processing_error(
                error_type="js_no_source",
                timestamp=self.start + timedelta(hours=1),
            ),
            self.create_processing_error(
                error_type="js_invalid_source",
                timestamp=self.start + timedelta(hours=1),
            ),
            self.create_processing_error(
                error_type="js_no_source",
                timestamp=self.start + timedelta(hours=2),
            ),
        ]
        self.store_processing_errors(items)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "processing_errors",
                "query": "error_type:js_no_source",
            },
        )
        assert response.status_code == 200, response.content
        data = [attrs for time, attrs in response.data["data"]]
        assert data[0] == [{"count": 0}]
        assert data[1] == [{"count": 1}]
        assert data[2] == [{"count": 1}]

    def test_top_events_with_no_data(self) -> None:
        response = self._do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=6),
                "interval": "1m",
                "yAxis": "count()",
                "field": ["error_type", "count()"],
                "orderby": ["-count"],
                "dataset": "processing_errors",
                "excludeOther": 0,
                "topEvents": 2,
            },
        )
        assert response.status_code == 200, response.content
