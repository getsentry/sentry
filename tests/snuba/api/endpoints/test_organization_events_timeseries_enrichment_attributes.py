from datetime import timedelta
from typing import Any

import pytest
from django.urls import reverse
from rest_framework.response import Response

from sentry.testutils.cases import EnrichmentAttributesTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase
from tests.snuba.api.endpoints.test_organization_events_timeseries_spans import (
    AnyConfidence,
    build_expected_timeseries,
)

any_confidence = AnyConfidence()

FRUSTRATION = "sentry.enrichment.poc_user_frustration"


class OrganizationEventsTimeseriesEnrichmentAttributesEndpointTest(
    OrganizationEventsEndpointTestBase, EnrichmentAttributesTestCase
):
    endpoint = "sentry-api-0-organization-events-timeseries"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=6)
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(
        self, data: dict[str, Any], features: dict[str, bool] | None = None
    ) -> Response:
        if features is None:
            features = {"organizations:classifiers-ui": True}
        features.update(self.features)
        with self.feature(features):
            return self.client_get(data=data, url=self.url)

    def test_count(self) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        items = []
        for hour, count in enumerate(event_counts):
            items.extend(
                [
                    self.create_enrichment_attributes(
                        {FRUSTRATION: 0.5},
                        timestamp=self.start + timedelta(hours=hour, minutes=minute),
                    )
                    for minute in range(count)
                ]
            )
        self.store_eap_items(items)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "enrichment_attributes",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "enrichment_attributes",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
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

    def test_avg_of_attribute(self) -> None:
        self.store_eap_items(
            [
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.2}, timestamp=self.start + timedelta(minutes=1)
                ),
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.6}, timestamp=self.start + timedelta(minutes=2)
                ),
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.9}, timestamp=self.start + timedelta(hours=2, minutes=1)
                ),
            ]
        )
        y_axis = f"avg(tags[{FRUSTRATION},number])"

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": y_axis,
                "project": self.project.id,
                "dataset": "enrichment_attributes",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert timeseries["yAxis"] == y_axis
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            [pytest.approx(0.4), 0, pytest.approx(0.9), 0, 0, 0],
            ignore_accuracy=True,
        )
        assert timeseries["meta"]["valueType"] == "number"

    def test_top_events(self) -> None:
        self.store_eap_items(
            [
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.1, "classifier": "user_frustration"},
                    timestamp=self.start + timedelta(minutes=1),
                ),
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.3, "classifier": "user_frustration"},
                    timestamp=self.start + timedelta(minutes=1),
                ),
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.8, "classifier": "other"},
                    timestamp=self.start + timedelta(minutes=1),
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
                "groupBy": ["classifier"],
                "sort": "-count()",
                "project": self.project.id,
                "dataset": "enrichment_attributes",
                "excludeOther": 1,
                "topEvents": 2,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 2
        first, second = response.data["timeSeries"]
        assert first["groupBy"] == [{"key": "classifier", "value": "user_frustration"}]
        assert first["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 2, 0, 0, 0, 0], ignore_accuracy=True
        )
        assert second["groupBy"] == [{"key": "classifier", "value": "other"}]
        assert second["values"] == build_expected_timeseries(
            self.start, 60_000, [0, 1, 0, 0, 0, 0], ignore_accuracy=True
        )

    def test_filter_on_attribute(self) -> None:
        self.store_eap_items(
            [
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.2, "classifier": "user_frustration"},
                    timestamp=self.start + timedelta(minutes=1),
                ),
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.4, "classifier": "user_frustration"},
                    timestamp=self.start + timedelta(hours=1, minutes=1),
                ),
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.9, "classifier": "other"},
                    timestamp=self.start + timedelta(minutes=1),
                ),
            ]
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "query": "classifier:user_frustration",
                "project": self.project.id,
                "dataset": "enrichment_attributes",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        assert response.data["timeSeries"][0]["values"] == build_expected_timeseries(
            self.start, 3_600_000, [1, 1, 0, 0, 0, 0], ignore_accuracy=True
        )

    def test_filter_on_numeric_attribute(self) -> None:
        self.store_eap_items(
            [
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.2}, timestamp=self.start + timedelta(minutes=1)
                ),
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.7}, timestamp=self.start + timedelta(minutes=2)
                ),
                self.create_enrichment_attributes(
                    {FRUSTRATION: 0.9}, timestamp=self.start + timedelta(hours=1, minutes=1)
                ),
            ]
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "query": f"tags[{FRUSTRATION},number]:>0.5",
                "project": self.project.id,
                "dataset": "enrichment_attributes",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        assert response.data["timeSeries"][0]["values"] == build_expected_timeseries(
            self.start, 3_600_000, [1, 1, 0, 0, 0, 0], ignore_accuracy=True
        )

    def test_requires_feature_flag(self) -> None:
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "dataset": "enrichment_attributes",
            },
            features={},
        )

        assert response.status_code == 400, response.content
