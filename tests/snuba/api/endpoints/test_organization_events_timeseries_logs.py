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
        assert response.data["meta"] == {
            "dataset": "ourlogs",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1
        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 6
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            event_counts,
            sample_count=event_counts,
            sample_rate=[1 if val else 0 for val in event_counts],
            confidence=[any_confidence if val else None for val in event_counts],
        )
        assert timeseries["meta"] == {
            "valueType": "integer",
            "interval": 3_600_000,
        }

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
        assert response.data["meta"] == {
            "dataset": "ourlogs",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeseries"]) == 1
        timeseries = response.data["timeseries"][0]
        assert len(timeseries["values"]) == 7
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            [0] * 7,
        )
