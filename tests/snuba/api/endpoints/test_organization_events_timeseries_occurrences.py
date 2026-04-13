from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.urls import reverse

from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import OccurrenceTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import (
    OrganizationEventsEndpointTestBase,
)
from tests.snuba.api.endpoints.test_organization_events_timeseries_spans import (
    AnyConfidence,
    build_expected_timeseries,
)

any_confidence = AnyConfidence()


class OrganizationEventsTimeseriesOccurrencesEndpointTest(
    OrganizationEventsEndpointTestBase, OccurrenceTestCase
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

    def _store_occurrences_and_request_timeseries(
        self,
        event_counts: list[int],
        y_axis: str,
        *,
        extra_occurrence_kwargs_fn: Callable[[int, int], dict[str, Any]] | None = None,
        **occurrence_kwargs: Any,
    ):
        """Create a group, build occurrences from event_counts (with group_id), store them, run timeseries request.
        extra_occurrence_kwargs_fn: when set, occurrence attributes are a function of (hour, minute).
        """
        group = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group.id,
                project=self.project,
                timestamp=self.start + timedelta(hours=hour, minutes=minute),
                **occurrence_kwargs,
                **(extra_occurrence_kwargs_fn(hour, minute) if extra_occurrence_kwargs_fn else {}),
            )
            for hour, count in enumerate(event_counts)
            for minute in range(count)
        ]
        self.store_eap_items(occurrences)
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            return self._do_request(
                data={
                    "start": self.start,
                    "end": self.end,
                    "interval": "1h",
                    "yAxis": y_axis,
                    "project": self.project.id,
                    "dataset": "occurrences",
                },
            )

    def test_count(self) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        response = self._store_occurrences_and_request_timeseries(
            event_counts,
            "count()",
            tags={"status": "success"},
            attributes={"description": "foo"},
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

    def _run_rate_timeseries_test(
        self,
        y_axis: str,
        value_unit: str,
        divisor: float,
    ) -> None:
        """Helper for eps/epm timeseries: request yAxis, assert rate per bucket."""
        event_counts = [2, 0, 2, 1, 0, 1]  # per 1h bucket
        response = self._store_occurrences_and_request_timeseries(
            event_counts, y_axis, attributes={"fingerprint": ["g1"]}
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"]["dataset"] == "occurrences"
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert timeseries["yAxis"] == y_axis
        assert timeseries["meta"]["valueType"] == "rate"
        assert timeseries["meta"]["valueUnit"] == value_unit
        assert timeseries["meta"]["interval"] == 3_600_000

        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            [pytest.approx(c / divisor, 0.001) for c in event_counts],
            sample_count=event_counts,
            sample_rate=[1 if val else None for val in event_counts],
            confidence=[any_confidence if val else None for val in event_counts],
        )

    def test_eps_timeseries(self) -> None:
        """Rate aggregate eps() on /events-timeseries: events/sec per bucket, meta rate/1/second."""
        self._run_rate_timeseries_test(
            "eps()",
            "1/second",
            3600.0,
        )

    def test_epm_timeseries(self) -> None:
        """Rate aggregate epm() on /events-timeseries: events/min per bucket, meta rate/1/minute."""
        self._run_rate_timeseries_test("epm()", "1/minute", 60.0)

    def test_count_unique_timeseries(self) -> None:
        event_counts = [6, 0, 6, 3, 0, 3]
        response = self._store_occurrences_and_request_timeseries(
            event_counts,
            "count_unique(title)",
            extra_occurrence_kwargs_fn=lambda hour, minute: {
                "title": f"foo-{minute}",
                "attributes": {"fingerprint": ["g1"]},
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"]["dataset"] == "occurrences"
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert timeseries["yAxis"] == "count_unique(title)"
        assert timeseries["values"] == build_expected_timeseries(
            self.start, 3_600_000, event_counts, ignore_accuracy=True
        )
        assert timeseries["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }
