from unittest import mock

from sentry.ingest.types import ConsumerType
from sentry.testutils.helpers.options import override_options
from sentry.utils.event_tracker import TransactionStageStatus, logger, track_sampled_event

EVENT_ID = "9cdc4c32dff14fbbb012b0aa9e908126"
CONSUMER_TYPE = ConsumerType.Transactions
STATUS = TransactionStageStatus.REDIS_PUT


@mock.patch.object(logger, "info")
def test_track_sampled_event_logs_event(mock_do_record):
    with override_options({"performance.event-tracker.sample-rate.transactions": 1.0}):
        track_sampled_event(EVENT_ID, CONSUMER_TYPE, STATUS)
    mock_do_record.assert_called_once_with(
        "EventTracker.recorded",
        extra={"event_id": EVENT_ID, "consumer_type": CONSUMER_TYPE, "status": STATUS},
    )


@mock.patch.object(logger, "info")
def test_track_sampled_event_does_not_log_event(mock_do_record):
    with override_options({"performance.event-tracker.sample-rate.transactions": 0.0}):
        track_sampled_event(EVENT_ID, CONSUMER_TYPE, STATUS)
    mock_do_record.assert_not_called()
