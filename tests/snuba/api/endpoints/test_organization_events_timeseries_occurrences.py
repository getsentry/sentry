import uuid
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
        self.reference_time = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.start = self.day_ago = self.reference_time
        self.end = self.reference_time + timedelta(hours=6)
        self.two_days_ago = self.reference_time - timedelta(days=1)

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

    def _do_occurrences_request(self, data, url=None, features=None):
        data = {**data, "dataset": "occurrences"}
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            return self._do_request(data=data, url=url, features=features)

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

        response = self._do_occurrences_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
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

    def test_count_filtered_by_release_and_environment(self) -> None:
        matching_counts = [2, 0, 3, 1, 0, 2]
        non_matching_counts = [1, 1, 1, 1, 1, 1]
        occurrences = []
        for hour, count in enumerate(matching_counts):
            occurrences.extend(
                [
                    self.create_occurrence(
                        {
                            "title": "matching occurrence",
                            "release": "frontend@2.0.0",
                            "environment": "staging",
                            "timestamp": (
                                self.start + timedelta(hours=hour, minutes=minute)
                            ).timestamp(),
                            "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
                        }
                    )
                    for minute in range(count)
                ]
            )
        for hour, count in enumerate(non_matching_counts):
            occurrences.extend(
                [
                    self.create_occurrence(
                        {
                            "title": "non matching occurrence",
                            "release": "frontend@1.0.0",
                            "environment": "production",
                            "timestamp": (
                                self.start + timedelta(hours=hour, minutes=30 + minute)
                            ).timestamp(),
                            "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
                        }
                    )
                    for minute in range(count)
                ]
            )
        self.store_eap_items([occurrence for occurrence, _ in occurrences])

        response = self._do_occurrences_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "query": "release:frontend@2.0.0 environment:staging",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            matching_counts,
            sample_count=matching_counts,
            sample_rate=[1 if val else None for val in matching_counts],
            confidence=[any_confidence if val else None for val in matching_counts],
        )

    def test_multiple_yaxis(self) -> None:
        event_counts = [3, 1, 2, 0, 2, 1]
        warning_counts = [2, 0, 1, 0, 1, 1]
        occurrences = []
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                level = "warning" if minute < warning_counts[hour] else "info"
                occurrences.append(
                    self.create_occurrence(
                        {
                            "title": f"occurrence {hour}-{minute}",
                            "level": level,
                            "timestamp": (
                                self.start + timedelta(hours=hour, minutes=minute)
                            ).timestamp(),
                            "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
                        }
                    )
                )
        self.store_eap_items([occurrence for occurrence, _ in occurrences])

        response = self._do_occurrences_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": ["count()", "count_if(level,equals,warning)"],
                "project": self.project.id,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "occurrences",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 2

        count_series = response.data["timeSeries"][0]
        assert count_series["yAxis"] == "count()"
        assert count_series["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            event_counts,
            sample_count=event_counts,
            sample_rate=[1 if val else None for val in event_counts],
            confidence=[any_confidence if val else None for val in event_counts],
        )
        assert count_series["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

        warning_series = response.data["timeSeries"][1]
        assert warning_series["yAxis"] == "count_if(level,equals,warning)"
        assert warning_series["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            warning_counts,
            sample_count=warning_counts,
            sample_rate=[1 if val else None for val in warning_counts],
            confidence=[any_confidence if val else None for val in warning_counts],
        )
        assert warning_series["meta"] == {
            "dataScanned": "full",
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_comparison_delta(self) -> None:
        event_counts = [4, 0, 2, 1, 0, 3]
        comparison_counts = [2, 0, 1, 1, 0, 1]
        occurrences = []
        for hour, count in enumerate(event_counts):
            occurrences.extend(
                [
                    self.create_occurrence(
                        {
                            "title": "current period",
                            "timestamp": (
                                self.start + timedelta(hours=hour, minutes=minute)
                            ).timestamp(),
                            "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
                        }
                    )
                    for minute in range(count)
                ]
            )
        for hour, count in enumerate(comparison_counts):
            occurrences.extend(
                [
                    self.create_occurrence(
                        {
                            "title": "comparison period",
                            "timestamp": (
                                self.two_days_ago + timedelta(hours=hour, minutes=minute)
                            ).timestamp(),
                            "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
                        }
                    )
                    for minute in range(count)
                ]
            )
        self.store_eap_items([occurrence for occurrence, _ in occurrences])

        response = self._do_occurrences_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "project": self.project.id,
                "comparisonDelta": 24 * 60 * 60,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == build_expected_timeseries(
            self.start,
            3_600_000,
            event_counts,
            comparison_counts,
            ignore_accuracy=True,
        )

    def test_top_events_not_supported_yet(self) -> None:
        alpha_counts = [3, 1, 2, 0, 0, 0]
        beta_counts = [1, 1, 0, 1, 0, 0]
        gamma_counts = [0, 0, 1, 0, 1, 0]
        occurrences = []
        for transaction, counts in [
            ("/alpha", alpha_counts),
            ("/beta", beta_counts),
            ("/gamma", gamma_counts),
        ]:
            for hour, count in enumerate(counts):
                occurrences.extend(
                    [
                        self.create_occurrence(
                            {
                                "transaction": transaction,
                                "title": f"{transaction} occurrence",
                                "timestamp": (
                                    self.start + timedelta(hours=hour, minutes=minute)
                                ).timestamp(),
                                "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
                            }
                        )
                        for minute in range(count)
                    ]
                )
        self.store_eap_items([occurrence for occurrence, _ in occurrences])

        response = self._do_occurrences_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "count()",
                "groupBy": ["transaction"],
                "orderby": ["-count()"],
                "topEvents": 2,
                "project": self.project.id,
            }
        )
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "<class 'sentry.snuba.occurrences_rpc.Occurrences'> doesn't support topEvents yet"
        )
