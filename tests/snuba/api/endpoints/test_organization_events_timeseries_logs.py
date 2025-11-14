from typing import int
from datetime import timedelta

from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase
from tests.snuba.api.endpoints.test_organization_events_timeseries_spans import (
    AnyConfidence,
    build_expected_timeseries,
)

any_confidence = AnyConfidence()


class OrganizationEventsStatsOurlogsMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-timeseries"

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
        assert response.data["meta"] == {
            "dataset": "logs",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            event_counts,
            sample_count=event_counts,
            sample_rate=[1 if val else None for val in event_counts],
            confidence=[any_confidence if val else None for val in event_counts],
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_top_events(self) -> None:
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo"},
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"environment": {"string_value": "prod"}},
                ),
                self.create_ourlog(
                    {"body": "foo"},
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"environment": {"string_value": "dev"}},
                ),
                self.create_ourlog(
                    {"body": "foo"},
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"environment": {"string_value": "prod"}},
                ),
                self.create_ourlog(
                    {"body": "foo"},
                    timestamp=self.start + timedelta(minutes=1),
                    attributes={"environment": {"string_value": "dev"}},
                ),
            ]
        )

        self.end = self.start + timedelta(minutes=6)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1m",
                "yAxis": "count()",
                "groupBy": ["environment"],
                "project": self.project.id,
                "dataset": "logs",
                "excludeOther": 0,
                "topEvents": 2,
            }
        )

        assert response.status_code == 200, response.content

        assert response.data["meta"] == {
            "dataset": "logs",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 2

        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "environment", "value": "prod"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 0,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert timeseries["groupBy"] == [{"key": "environment", "value": "dev"}]
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 60_000,
            "isOther": False,
            "order": 1,
        }

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
        assert response.data["meta"] == {
            "dataset": "logs",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 7
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            [0] * 7,
        )
