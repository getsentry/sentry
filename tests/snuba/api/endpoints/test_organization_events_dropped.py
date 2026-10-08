from datetime import timedelta
from typing import Any
from unittest.mock import patch

from django.urls import reverse

from sentry.constants import DataCategory
from sentry.testutils.cases import APITestCase, OutcomesSnubaTest
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.outcomes import Outcome


class OrganizationEventsDroppedEndpointTest(APITestCase, OutcomesSnubaTest):
    endpoint = "sentry-api-0-organization-events-dropped"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        # Align to an hour boundary so the hourly Outcomes rollup buckets cleanly.
        self.end = before_now(days=1).replace(minute=0, second=0, microsecond=0)
        self.start = self.end - timedelta(hours=2)
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def _store_outcome(
        self,
        outcome: Outcome,
        category: DataCategory,
        quantity: int,
        reason: str = "none",
        minutes: int = 30,
    ) -> None:
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": outcome,
                "reason": reason,
                "category": category,
                "timestamp": self.start + timedelta(minutes=minutes),
                "quantity": quantity,
            }
        )

    def _do_request(
        self,
        dataset: str = "logs",
        interval: str = "1h",
        outcome: str | None = None,
        reason: str | None = None,
    ) -> Any:
        data: dict[str, Any] = {
            "start": self.start,
            "end": self.end,
            "interval": interval,
            "project": [self.project.id],
            "dataset": dataset,
        }
        if outcome is not None:
            data["outcome"] = outcome
        if reason is not None:
            data["reason"] = reason
        with self.feature({"organizations:visibility-explore-view": True}):
            return self.client.get(self.url, data=data, format="json")

    def test_serves_dropped_and_accepted_events(self) -> None:
        self._store_outcome(Outcome.ACCEPTED, DataCategory.LOG_ITEM, 1000)
        self._store_outcome(Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, 400, reason="key_quota")

        response = self._do_request()
        assert response.status_code == 200, response.content

        meta = response.data["meta"]
        assert meta["dataset"] == "logs"
        assert meta["interval"] == 3600 * 1000

        dropped = response.data["droppedEvents"]
        assert len(dropped) == 1
        assert dropped[0]["outcome"] == Outcome.RATE_LIMITED.api_name()
        assert dropped[0]["reason"] == "key_quota"
        assert dropped[0]["count"] == 400

        accepted = response.data["acceptedEvents"]
        assert len(accepted) == 1
        assert accepted[0]["outcome"] == "accepted"
        assert accepted[0]["reason"] == "accepted"
        assert accepted[0]["count"] == 1000

    def test_records_usage_metric(self) -> None:
        self._store_outcome(Outcome.ACCEPTED, DataCategory.LOG_ITEM, 1000)
        self._store_outcome(Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, 400, reason="key_quota")

        with patch("sentry.api.helpers.data_annotations.metrics.incr") as mock_incr:
            response = self._do_request()
        assert response.status_code == 200, response.content

        mock_incr.assert_any_call(
            "dropped_events.served",
            tags={
                "endpoint": "events-dropped",
                "client_kind": "frontend",
                "dataset": "logs",
                "had_drops": True,
            },
        )

    def test_same_reason_under_different_outcomes_stays_distinct(self) -> None:
        # Volume is keyed by (bucket, outcome, reason). The same reason string can
        # appear under different outcomes, so outcome must be on the wire to keep
        # them from collapsing into one indistinguishable bucket.
        self._store_outcome(
            Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, 400, reason="key_quota", minutes=20
        )
        self._store_outcome(
            Outcome.ABUSE, DataCategory.LOG_ITEM, 150, reason="key_quota", minutes=40
        )

        response = self._do_request()
        assert response.status_code == 200, response.content

        dropped = response.data["droppedEvents"]
        by_outcome = {b["outcome"]: b for b in dropped}
        assert set(by_outcome) == {
            Outcome.RATE_LIMITED.api_name(),
            Outcome.ABUSE.api_name(),
        }
        assert by_outcome[Outcome.RATE_LIMITED.api_name()]["count"] == 400
        assert by_outcome[Outcome.ABUSE.api_name()]["count"] == 150
        assert all(b["reason"] == "key_quota" for b in dropped)

    def test_interval_is_configurable_independent_of_a_chart(self) -> None:
        # A finer interval splits the two-hour window into more buckets than the
        # 1h case; the endpoint honors the requested granularity directly.
        self._store_outcome(Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, 400, reason="key_quota")

        response = self._do_request(interval="30m")
        assert response.status_code == 200, response.content
        assert response.data["meta"]["interval"] == 1800 * 1000

    def test_unsupported_dataset_is_rejected(self) -> None:
        response = self._do_request(dataset="discover")
        assert response.status_code == 400, response.content
        assert "does not support dropped events" in response.data["detail"]

    def test_errors_dataset_serves_dropped_and_accepted(self) -> None:
        # errors maps to DataCategory.ERROR; no byte category, like spans/metrics.
        self._store_outcome(Outcome.ACCEPTED, DataCategory.ERROR, 1000)
        self._store_outcome(Outcome.RATE_LIMITED, DataCategory.ERROR, 400, reason="key_quota")

        response = self._do_request(dataset="errors")
        assert response.status_code == 200, response.content
        assert response.data["meta"]["dataset"] == "errors"

    def test_outcome_filter_scopes_dropped_but_keeps_accepted_whole(self) -> None:
        # The core contract: filtering by outcome returns only that drop series,
        # while the full accepted volume (the share denominator) still comes back.
        self._store_outcome(Outcome.ACCEPTED, DataCategory.LOG_ITEM, 1000)
        self._store_outcome(
            Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, 400, reason="key_quota", minutes=20
        )
        self._store_outcome(
            Outcome.INVALID, DataCategory.LOG_ITEM, 250, reason="invalid_data", minutes=40
        )

        response = self._do_request(outcome=Outcome.RATE_LIMITED.api_name())
        assert response.status_code == 200, response.content

        dropped = response.data["droppedEvents"]
        assert len(dropped) == 1
        assert dropped[0]["outcome"] == Outcome.RATE_LIMITED.api_name()
        assert dropped[0]["reason"] == "key_quota"
        assert dropped[0]["count"] == 400

        accepted = response.data["acceptedEvents"]
        assert len(accepted) == 1
        assert accepted[0]["count"] == 1000

    def test_reason_filter_narrows_within_an_outcome(self) -> None:
        # reason isolates one sub-classification; the sibling reason under the same
        # outcome is excluded.
        self._store_outcome(
            Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, 400, reason="key_quota", minutes=20
        )
        self._store_outcome(
            Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, 150, reason="spike_protection", minutes=40
        )

        response = self._do_request(
            outcome=Outcome.RATE_LIMITED.api_name(), reason="spike_protection"
        )
        assert response.status_code == 200, response.content

        dropped = response.data["droppedEvents"]
        assert len(dropped) == 1
        assert dropped[0]["reason"] == "spike_protection"
        assert dropped[0]["count"] == 150
