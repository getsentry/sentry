from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data
from tests.snuba.api.endpoints.test_organization_events_facets_performance import (
    BaseOrganizationEventsFacetsPerformanceEndpointTest,
)


@region_silo_test
class OrganizationEventsFacetsPerformanceEndpointTest(
    BaseOrganizationEventsFacetsPerformanceEndpointTest
):
    def setUp(self):
        super().setUp()

        self._transaction_count = 0
        self.two_days_ago = before_now(days=2).replace(microsecond=0)
        self.three_days_ago = before_now(days=3).replace(microsecond=0)

        timestamps = [self.two_mins_ago, self.day_ago, self.two_days_ago, self.three_days_ago]

        for i in range(5):
            self.store_transaction(
                tags=[["color", "blue"], ["many", "yes"]],
                duration=4000,
                lcp=3000,
                timestamp=timestamps[i % 4],
            )
        for i in range(14):
            self.store_transaction(
                tags=[["color", "red"], ["many", "yes"]],
                duration=1000,
                lcp=500,
                timestamp=timestamps[i % 4],
            )
        for i in range(1):
            self.store_transaction(
                tags=[["color", "green"], ["many", "no"]],
                duration=5000,
                lcp=4000,
                timestamp=timestamps[i % 4],
            )

        self.url = reverse(
            "sentry-api-0-organization-events-facets-stats-performance",
            kwargs={"organization_slug": self.project.organization.slug},
        )

    def store_transaction(
        self,
        name="exampleTransaction",
        duration=100,
        tags=None,
        project_id=None,
        lcp=None,
        timestamp=None,
    ):
        if tags is None:
            tags = []
        if project_id is None:
            project_id = self.project.id
        if timestamp is None:
            timestamp = self.two_mins_ago

        event = load_data("transaction").copy()
        event.data["tags"].extend(tags)
        event.update(
            {
                "transaction": name,
                "event_id": f"{self._transaction_count:02x}".rjust(32, "0"),
                "start_timestamp": iso_format(timestamp - timedelta(seconds=duration)),
                "timestamp": iso_format(timestamp),
            }
        )

        if lcp:
            event["measurements"]["lcp"]["value"] = lcp
        else:
            del event["measurements"]["lcp"]

        self._transaction_count += 1
        self.store_event(data=event, project_id=project_id)

    @pytest.mark.skip("Flaky test failing because of Query timeout.")
    def test_basic_request(self):
        response = self.do_request(
            {
                "statsPeriod": "14d",
                "aggregateColumn": "transaction.duration",
            }
        )
        assert response.status_code == 200, response.content

        data = response.data

        assert len(data["totals"]) == 2
        assert data["totals"]["color,blue"] == {
            "aggregate": 4000000.0,
            "comparison": 2.051282051282051,
            "count": 5,
            "frequency": 0.25,
            "sumdelta": 10250000.0,
            "count_delta": -1.0,
            "count_range_1": 5,
            "count_range_total": 5,
            "sum_correlation": 0.9718819143525331,
        }

        assert data["color,blue"]
        assert data["many,no"]

        series = data["color,blue"]["count()"]["data"]
        assert len(series) == 56
        assert series[-4][1][0]["count"] == 1
