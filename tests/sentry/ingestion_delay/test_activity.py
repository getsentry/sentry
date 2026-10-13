from datetime import UTC, datetime, timedelta
from unittest import mock

from django.core.cache import cache
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.constants import DataCategory
from sentry.ingestion_delay.activity import get_accepted_outcomes, has_accepted_outcomes
from sentry.testutils.cases import OutcomesSnubaTest, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.outcomes import Outcome


class HasAcceptedOutcomesTest(OutcomesSnubaTest):
    def setUp(self) -> None:
        super().setUp()
        self.now = before_now(minutes=0)

    def _store_accepted(self, minutes_ago: int, quantity: int = 10) -> None:
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.SPAN,
                "timestamp": self.now - timedelta(minutes=minutes_ago),
                "quantity": quantity,
            }
        )

    def _check(self, start_minutes_ago: int, end_minutes_ago: int = 0) -> bool | None:
        return has_accepted_outcomes(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            start=self.now - timedelta(minutes=start_minutes_ago),
            end=self.now - timedelta(minutes=end_minutes_ago),
        )

    def test_accepted_within_the_window(self) -> None:
        self._store_accepted(minutes_ago=10)
        assert self._check(start_minutes_ago=30) is True

    def test_no_outcomes_at_all(self) -> None:
        assert self._check(start_minutes_ago=30) is False

    def test_accepted_outside_the_window_does_not_count(self) -> None:
        self._store_accepted(minutes_ago=90)
        assert self._check(start_minutes_ago=30) is False

    def test_recent_data_is_excluded_by_the_end_bound(self) -> None:
        # Accepted 2 minutes ago, window ends 5 minutes ago. This is the
        # in-flight case: counting it would flag a healthy pipeline as stalled.
        self._store_accepted(minutes_ago=2)
        assert self._check(start_minutes_ago=30, end_minutes_ago=5) is False

    def test_unsupported_item_type_is_unknown(self) -> None:
        assert (
            has_accepted_outcomes(
                organization_id=self.organization.id,
                project_ids=[self.project.id],
                item_type=TraceItemType.TRACE_ITEM_TYPE_UNSPECIFIED,
                start=self.now - timedelta(minutes=30),
                end=self.now,
            )
            is None
        )


@mock.patch("sentry.ingestion_delay.activity.has_accepted_outcomes")
class GetAcceptedOutcomesCacheTest(TestCase):
    item_type = TraceItemType.TRACE_ITEM_TYPE_SPAN
    now = datetime(2020, 1, 1, 12, 0, tzinfo=UTC)

    def setUp(self) -> None:
        super().setUp()
        cache.clear()
        self.project

    def _get(
        self,
        project_ids: list[int] | None = None,
        seconds_ago: int = 0,
        last_ingested_seconds_ago: float | None = 600,
        delay_seconds: float | None = 5.0,
    ) -> bool | None:
        last_ingested_at = (
            None
            if last_ingested_seconds_ago is None
            else self.now - timedelta(seconds=last_ingested_seconds_ago)
        )
        return get_accepted_outcomes(
            organization_id=self.organization.id,
            project_ids=project_ids or [self.project.id],
            item_type=self.item_type,
            start=last_ingested_at or self.now - timedelta(minutes=60),
            end=self.now - timedelta(seconds=seconds_ago),
            last_ingested_at=last_ingested_at,
            delay_seconds=delay_seconds,
        )

    @mock.patch("sentry.ingestion_delay.activity.metrics.incr")
    def test_second_call_is_served_from_cache(
        self, mock_incr: mock.MagicMock, mock_accepted: mock.MagicMock
    ) -> None:
        mock_accepted.return_value = True

        assert self._get(project_ids=[self.project.id]) is True
        assert self._get(project_ids=[self.project.id]) is True
        assert self._get(project_ids=[self.project.id, 42]) is True
        assert self._get(project_ids=[42, self.project.id]) is True
        assert mock_accepted.call_count == 2
        assert mock_incr.call_args_list == [
            mock.call("ingestion_delay.outcomes_cache", tags={"result": result})
            for result in ("miss", "hit", "miss", "hit")
        ]

    def test_failed_outcomes_is_not_cached(self, mock_accepted: mock.MagicMock) -> None:
        mock_accepted.side_effect = [None, True]

        assert self._get() is None
        assert self._get() is True
        assert mock_accepted.call_count == 2

    def test_new_measurements_forces_outcomes_refresh(self, mock_accepted: mock.MagicMock) -> None:
        mock_accepted.return_value = True

        assert self._get(last_ingested_seconds_ago=600, delay_seconds=10.0) is True
        assert self._get(last_ingested_seconds_ago=120, delay_seconds=5.0) is True
        assert self._get(last_ingested_seconds_ago=None, delay_seconds=None) is True
        assert mock_accepted.call_count == 3
