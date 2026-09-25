from datetime import timedelta
from typing import Any

from django.urls import reverse

from sentry.constants import DataCategory
from sentry.testutils.cases import APITestCase, OutcomesSnubaTest
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.outcomes import Outcome


class OrganizationEventsAnnotationsEndpointTest(APITestCase, OutcomesSnubaTest):
    endpoint = "sentry-api-0-organization-events-annotations"

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

    def _do_request(self, dataset: str = "logs", interval: str = "1h") -> Any:
        data: dict[str, Any] = {
            "start": self.start,
            "end": self.end,
            "interval": interval,
            "project": [self.project.id],
            "dataset": dataset,
        }
        with self.feature({"organizations:visibility-explore-view": True}):
            return self.client.get(self.url, data=data, format="json")

    def test_serves_dropped_and_accepted_annotations(self) -> None:
        self._store_outcome(Outcome.ACCEPTED, DataCategory.LOG_ITEM, 1000)
        self._store_outcome(Outcome.ACCEPTED, DataCategory.LOG_BYTE, 500_000)
        self._store_outcome(Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, 400, reason="key_quota")
        self._store_outcome(
            Outcome.RATE_LIMITED, DataCategory.LOG_BYTE, 200_000, reason="key_quota"
        )

        response = self._do_request()
        assert response.status_code == 200, response.content

        meta = response.data["meta"]
        assert meta["dataset"] == "logs"
        assert meta["interval"] == 3600 * 1000

        dropped = response.data["droppedAnnotations"]
        assert len(dropped) == 1
        assert dropped[0]["outcome"] == Outcome.RATE_LIMITED.api_name()
        assert dropped[0]["reason"] == "key_quota"
        assert dropped[0]["eventCount"] == 400
        assert dropped[0]["byteSize"] == 200_000

        accepted = response.data["acceptedAnnotations"]
        assert len(accepted) == 1
        assert accepted[0]["eventCount"] == 1000
        assert accepted[0]["byteSize"] == 500_000

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
        assert "does not support annotations" in response.data["detail"]
