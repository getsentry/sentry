from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import BaseOccurrenceTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import (
    OrganizationEventsEndpointTestBase,
)
from tests.snuba.api.endpoints.test_organization_events_timeseries_spans import (
    AnyConfidence,
    build_expected_timeseries,
)

any_confidence = AnyConfidence()

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsTimeseriesOccurrencesEndpointTest(
    OrganizationEventsEndpointTestBase, BaseOccurrenceTestCase
):
    endpoint = "sentry-api-0-organization-events-timeseries"
    callsite_name = "api.events.endpoints"

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
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_count(self) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        occurrence_and_groups = []
        for hour, count in enumerate(event_counts):
            occurrence_and_groups.extend(
                [
                    self.create_occurrence(
                        {
                            "description": "foo",
                            "sentry_tags": {"status": "success"},
                            "timestamp": (
                                self.start + timedelta(hours=hour, minutes=minute)
                            ).timestamp(),
                        },
                    )
                    for minute in range(count)
                ],
            )
        self.store_eap_items([occurrence for occurrence, group in occurrence_and_groups])

        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "1h",
                    "yAxis": "count()",
                    "project": self.project.id,
                    "dataset": "occurrences",
                },
            )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "occurrences",
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
