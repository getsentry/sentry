from datetime import timedelta
from unittest import mock

from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.ingestion_delay.query import IngestionDelayMeasurement, get_measurement_lookback
from sentry.ingestion_delay.status import (
    STALL_GRACE,
    STALL_MARGIN,
    IngestionDelayStatus,
    IngestionStatus,
    get_ingestion_delay_status,
)
from sentry.testutils.cases import TestCase

SPAN = TraceItemType.TRACE_ITEM_TYPE_SPAN
Status = IngestionStatus


class GetIngestionDelayStatusTest(TestCase):
    def _status(
        self,
        delay_seconds: float | None = None,
        ingested_seconds_ago: float | None = None,
        accepted: bool | None = None,
        succeeded: bool = True,
    ) -> IngestionDelayStatus:
        with (
            mock.patch("sentry.ingestion_delay.status.datetime") as mock_datetime,
            mock.patch(
                "sentry.ingestion_delay.status.get_ingestion_delay_measurement"
            ) as mock_measure,
            mock.patch(
                "sentry.ingestion_delay.status.get_accepted_outcomes", return_value=accepted
            ) as mock_accepted,
        ):
            from datetime import UTC, datetime

            now = datetime(2020, 1, 1, 12, 0, tzinfo=UTC)
            mock_datetime.now.return_value = now
            self.now = now
            mock_measure.return_value = IngestionDelayMeasurement(
                succeeded=succeeded,
                delay_seconds=delay_seconds,
                last_ingested_at=(
                    None
                    if ingested_seconds_ago is None
                    else now - timedelta(seconds=ingested_seconds_ago)
                ),
            )
            self.mock_accepted = mock_accepted
            return get_ingestion_delay_status(self.organization.id, [self.project.id], SPAN)

    def test_recent_write_is_healthy_without_asking_outcomes(self) -> None:
        status = self._status(delay_seconds=60.0, ingested_seconds_ago=30)

        assert status.status == Status.HEALTHY
        assert status.delay_seconds == 60.0 + STALL_MARGIN.total_seconds()
        assert status.complete_through == self.now - timedelta(seconds=60) - STALL_MARGIN
        assert not self.mock_accepted.called

    def test_recent_write_is_healthy_within_stall_margin(self) -> None:
        status = self._status(
            delay_seconds=60.0, ingested_seconds_ago=119
        )  # stall margin is 60 seconds, so 119 < 60 + 60

        assert status.status == Status.HEALTHY
        assert status.delay_seconds == 60.0 + STALL_MARGIN.total_seconds()
        assert status.complete_through == self.now - timedelta(seconds=60) - STALL_MARGIN
        assert not self.mock_accepted.called

    def test_old_write_with_accepted_data_is_stalled(self) -> None:
        status = self._status(delay_seconds=60.0, ingested_seconds_ago=3600, accepted=True)

        assert status.status == Status.STALLED
        assert status.delay_seconds == 60.0 + STALL_MARGIN.total_seconds()
        assert status.complete_through == self.now - timedelta(seconds=3600)
        assert self.mock_accepted.call_args.kwargs["start"] == self.now - timedelta(seconds=3600)
        assert (
            self.mock_accepted.call_args.kwargs["end"]
            == self.now - timedelta(seconds=60) - STALL_MARGIN
        )

    def test_old_write_without_accepted_data_is_idle(self) -> None:
        status = self._status(delay_seconds=60.0, ingested_seconds_ago=3600, accepted=False)

        assert status.status == Status.IDLE
        assert status.delay_seconds == 60.0 + STALL_MARGIN.total_seconds()
        assert status.complete_through == self.now - timedelta(seconds=60) - STALL_MARGIN
        assert self.mock_accepted.call_args.kwargs["start"] == self.now - timedelta(seconds=3600)
        assert (
            self.mock_accepted.call_args.kwargs["end"]
            == self.now - timedelta(seconds=60) - STALL_MARGIN
        )

    def test_no_outcomes_is_unknown(self) -> None:
        status = self._status(delay_seconds=60.0, ingested_seconds_ago=3600, accepted=None)

        assert status.status == Status.UNKNOWN
        assert status.complete_through is None
        assert status.delay_seconds == 60.0 + STALL_MARGIN.total_seconds()
        assert self.mock_accepted.call_args.kwargs["start"] == self.now - timedelta(seconds=3600)
        assert (
            self.mock_accepted.call_args.kwargs["end"]
            == self.now - timedelta(seconds=60) - STALL_MARGIN
        )

    def test_no_rows_with_accepted_data_is_stalled(self) -> None:
        status = self._status(accepted=True)

        assert status.status == Status.STALLED
        assert status.delay_seconds is None
        assert status.complete_through is None
        assert self.mock_accepted.call_args.kwargs["start"] == self.now - get_measurement_lookback()
        assert self.mock_accepted.call_args.kwargs["end"] == self.now - STALL_GRACE

    def test_no_rows_without_accepted_data_is_idle(self) -> None:
        status = self._status(accepted=False)

        assert status.status == Status.IDLE
        assert status.delay_seconds is None
        assert status.complete_through is None
        assert self.mock_accepted.call_args.kwargs["start"] == self.now - get_measurement_lookback()
        assert self.mock_accepted.call_args.kwargs["end"] == self.now - STALL_GRACE

    def test_failed_measurement_is_unknown(self) -> None:
        status = self._status(succeeded=False)
        assert status.status == Status.UNKNOWN
        assert status.complete_through is None
        assert not self.mock_accepted.called
