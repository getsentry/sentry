from __future__ import annotations

from datetime import datetime, timedelta

from sentry.api.helpers.data_annotations import get_dropped_data_annotations
from sentry.constants import DataCategory
from sentry.search.events.types import SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import OurLogTestCase, OutcomesSnubaTest, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.outcomes import Outcome

ONE_HOUR = 3600


class GetDroppedDataAnnotationsTest(OutcomesSnubaTest, SnubaTestCase, OurLogTestCase):
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

        annotations = get_dropped_data_annotations(Spans, self._snuba_params(), ONE_HOUR)
        dropped, accepted = annotations.dropped, annotations.accepted

        assert len(dropped) == 1
        assert dropped[0]["category"] == DataCategory.SPAN.api_name()
        assert dropped[0]["outcome"] == Outcome.RATE_LIMITED.api_name()
        assert dropped[0]["reason"] == "over_quota"
        assert dropped[0]["eventCount"] == 2000
        assert dropped[0]["end"] - dropped[0]["start"] == ONE_HOUR * 1000
        assert "label" not in dropped[0]

        assert len(accepted) == 1
        assert accepted[0]["outcome"] == Outcome.ACCEPTED.api_name()
        assert accepted[0]["eventCount"] == 8000
        assert "label" not in accepted[0]

    def test_accepted_emitted_without_any_drop(self) -> None:
        # Accepted is independent of drops: a bucket with only accepted traffic
        # still produces an accepted annotation and no dropped ones.
        when = self.start + timedelta(minutes=30)
        self._store_drop(Outcome.ACCEPTED, DataCategory.SPAN, when, quantity=5000)

        annotations = get_dropped_data_annotations(Spans, self._snuba_params(), ONE_HOUR)

        assert annotations.dropped == []
        assert len(annotations.accepted) == 1
        assert annotations.accepted[0]["eventCount"] == 5000

    def _store_sdk_log(
        self, sdk_name: str, sdk_version: str, environment: str = "production"
    ) -> None:
        self.store_eap_items(
            [
                self.create_ourlog(
                    timestamp=self.start + timedelta(minutes=30),
                    attributes={
                        "sentry.sdk.name": sdk_name,
                        "sentry.sdk.version": sdk_version,
                        "environment": environment,
                    },
                )
            ]
        )

    def _store_log_drops(self) -> None:
        when = self.start + timedelta(minutes=30)
        self._store_drop(
            Outcome.CLIENT_DISCARD,
            DataCategory.LOG_ITEM,
            when,
            reason="buffer_overflow",
            quantity=300,
        )
        self._store_drop(
            Outcome.RATE_LIMITED, DataCategory.LOG_ITEM, when, reason="key_quota", quantity=100
        )

    def test_hides_log_buffer_overflow_from_old_js_sdk(self) -> None:
        self._store_log_drops()
        self._store_sdk_log("sentry.javascript.browser", "10.5.0")

        annotations = get_dropped_data_annotations(OurLogs, self._snuba_params(), ONE_HOUR)

        assert [(d["outcome"], d["reason"]) for d in annotations.dropped] == [
            (Outcome.RATE_LIMITED.api_name(), "key_quota")
        ]
        assert annotations.suppressed == [
            {
                "cause": "js_sdk_below_11",
                "category": DataCategory.LOG_ITEM.api_name(),
                "outcome": Outcome.CLIENT_DISCARD.api_name(),
                "reason": "buffer_overflow",
                "count": 300,
            }
        ]

    def test_hides_log_buffer_overflow_from_old_js_sdk_outside_selected_environment(
        self,
    ) -> None:
        # Outcomes carry no environment, so the SDK lookup must not be narrowed by one.
        self._store_log_drops()
        self._store_sdk_log("sentry.javascript.browser", "10.5.0", environment="staging")
        self._store_sdk_log("sentry.javascript.browser", "11.0.0", environment="production")
        snuba_params = self._snuba_params()
        snuba_params.environments = [self.create_environment(name="production")]

        annotations = get_dropped_data_annotations(OurLogs, snuba_params, ONE_HOUR)

        assert [(d["outcome"], d["reason"]) for d in annotations.dropped] == [
            (Outcome.RATE_LIMITED.api_name(), "key_quota")
        ]
        assert [drop["count"] for drop in annotations.suppressed] == [300]

    def test_keeps_log_buffer_overflow_without_old_js_sdk(self) -> None:
        # Neither an 11.x prerelease nor an older non-JavaScript SDK is affected.
        self._store_log_drops()
        self._store_sdk_log("sentry.javascript.browser", "11.0.0-beta.1")
        self._store_sdk_log("sentry.python", "2.0.0")

        annotations = get_dropped_data_annotations(OurLogs, self._snuba_params(), ONE_HOUR)

        assert {d["reason"] for d in annotations.dropped} == {"buffer_overflow", "key_quota"}
        assert annotations.suppressed == []
