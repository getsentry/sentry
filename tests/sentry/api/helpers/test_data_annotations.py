from __future__ import annotations

from datetime import datetime, timedelta

from sentry.api.helpers.data_annotations import get_dropped_data_annotations
from sentry.constants import DataCategory
from sentry.search.events.types import SnubaParams
from sentry.snuba import errors
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
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

    def test_returns_dropped_span_outcomes(self) -> None:
        drop_at = self.start + timedelta(minutes=30)
        self._store_drop(
            Outcome.RATE_LIMITED, DataCategory.SPAN, drop_at, reason="over_quota", quantity=2000
        )

        annotations = get_dropped_data_annotations(Spans, self._snuba_params(), ONE_HOUR)

        assert len(annotations) == 1
        annotation = annotations[0]
        assert annotation["type"] == "system"
        assert annotation["category"] == DataCategory.SPAN.api_name()
        assert annotation["reason"] == "over_quota"
        assert annotation["droppedCount"] == 2000
        assert annotation["label"] == "Quota exceeded"
        # The bucket spans exactly one rollup interval.
        assert annotation["end"] - annotation["start"] == ONE_HOUR * 1000

    def test_accepted_outcomes_are_not_annotations(self) -> None:
        when = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.ACCEPTED, DataCategory.SPAN, when, reason="none", quantity=5000)

        annotations = get_dropped_data_annotations(Spans, self._snuba_params(), ONE_HOUR)

        assert annotations == []

    def test_threshold_filters_small_drops(self) -> None:
        when = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.INVALID, DataCategory.SPAN, when, quantity=3)

        annotations = get_dropped_data_annotations(
            Spans, self._snuba_params(), ONE_HOUR, threshold=100
        )

        assert annotations == []

    def test_category_scoped_to_dataset(self) -> None:
        # A dropped log should not surface on a spans chart.
        when = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, when, quantity=500)

        span_annotations = get_dropped_data_annotations(Spans, self._snuba_params(), ONE_HOUR)
        log_annotations = get_dropped_data_annotations(OurLogs, self._snuba_params(), ONE_HOUR)

        assert span_annotations == []
        assert len(log_annotations) == 1
        assert log_annotations[0]["category"] == DataCategory.LOG_ITEM.api_name()

    def test_trace_metrics_dataset_supported(self) -> None:
        when = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.INVALID, DataCategory.TRACE_METRIC, when, quantity=750)

        annotations = get_dropped_data_annotations(TraceMetrics, self._snuba_params(), ONE_HOUR)

        assert len(annotations) == 1
        assert annotations[0]["category"] == DataCategory.TRACE_METRIC.api_name()
        assert annotations[0]["droppedCount"] == 750

    def test_unsupported_dataset_returns_empty(self) -> None:
        when = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.RATE_LIMITED, DataCategory.SPAN, when, quantity=500)

        # An object with no category mapping yields no annotations rather than
        # raising. v0 is EAP-only, so non-EAP datasets (e.g. errors) map to nothing.
        assert get_dropped_data_annotations(object(), self._snuba_params(), ONE_HOUR) == []
        assert get_dropped_data_annotations(errors, self._snuba_params(), ONE_HOUR) == []
