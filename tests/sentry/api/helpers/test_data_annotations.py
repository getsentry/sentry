from __future__ import annotations

from datetime import datetime, timedelta

from sentry.api.helpers.data_annotations import get_dropped_data_annotations
from sentry.constants import DataCategory
from sentry.search.events.types import SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import OutcomesSnubaTest
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.outcomes import Outcome

ONE_HOUR = 3600


class GetDroppedDataAnnotationsTest(OutcomesSnubaTest):
    def setUp(self) -> None:
        super().setUp()
        # Align to an hour boundary so the hourly Outcomes rollup buckets cleanly.
        self.end = before_now(days=1).replace(minute=0, second=0, microsecond=0)
        self.start = self.end - timedelta(hours=3)

    def _snuba_params(self) -> SnubaParams:
        return SnubaParams(
            start=self.start,
            end=self.end,
            projects=[self.project],
            organization=self.organization,
        )

    def _store_drop(
        self,
        outcome: Outcome,
        category: DataCategory,
        when: datetime,
        reason: str = "none",
        quantity: int = 1,
        num_times: int = 1,
    ) -> None:
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": outcome,
                "reason": reason,
                "category": category,
                "timestamp": when,
                "quantity": quantity,
            },
            num_times=num_times,
        )

    def test_dropped_and_accepted_series_spans(self) -> None:
        # Core happy path: accepted and dropped come back as two independent series.
        drop_at = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.ACCEPTED, DataCategory.SPAN, drop_at, quantity=8000)
        self._store_drop(
            Outcome.RATE_LIMITED, DataCategory.SPAN, drop_at, reason="over_quota", quantity=2000
        )

        dropped, accepted = get_dropped_data_annotations(Spans, self._snuba_params(), ONE_HOUR)

        assert len(dropped) == 1
        assert dropped[0]["category"] == DataCategory.SPAN.api_name()
        assert dropped[0]["outcome"] == Outcome.RATE_LIMITED.api_name()
        assert dropped[0]["reason"] == "over_quota"
        assert dropped[0]["eventCount"] == 2000
        assert dropped[0]["end"] - dropped[0]["start"] == ONE_HOUR * 1000
        assert "label" not in dropped[0]
        assert "byteSize" not in dropped[0]

        assert len(accepted) == 1
        assert accepted[0]["outcome"] == Outcome.ACCEPTED.api_name()
        assert accepted[0]["eventCount"] == 8000
        assert "label" not in accepted[0]
        assert "byteSize" not in accepted[0]

    def test_log_series_carry_byte_size(self) -> None:
        # Logs are the only v0 dataset with a paired byte category, so both series
        # carry byteSize alongside eventCount.
        drop_at = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.ACCEPTED, DataCategory.LOG_ITEM, drop_at, quantity=1000)
        self._store_drop(Outcome.ACCEPTED, DataCategory.LOG_BYTE, drop_at, quantity=500_000)
        self._store_drop(
            Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, drop_at, reason="key_quota", quantity=400
        )
        self._store_drop(
            Outcome.RATE_LIMITED,
            DataCategory.LOG_BYTE,
            drop_at,
            reason="key_quota",
            quantity=200_000,
        )

        dropped, accepted = get_dropped_data_annotations(OurLogs, self._snuba_params(), ONE_HOUR)

        assert len(dropped) == 1
        assert dropped[0]["category"] == DataCategory.LOG_ITEM.api_name()
        assert dropped[0]["eventCount"] == 400
        assert dropped[0]["byteSize"] == 200_000

        assert len(accepted) == 1
        assert accepted[0]["eventCount"] == 1000
        assert accepted[0]["byteSize"] == 500_000

    def test_accepted_emitted_without_any_drop(self) -> None:
        # Accepted is independent of drops: a bucket with only accepted traffic
        # still produces an accepted annotation and no dropped ones.
        when = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.ACCEPTED, DataCategory.SPAN, when, quantity=5000)

        dropped, accepted = get_dropped_data_annotations(Spans, self._snuba_params(), ONE_HOUR)

        assert dropped == []
        assert len(accepted) == 1
        assert accepted[0]["eventCount"] == 5000
