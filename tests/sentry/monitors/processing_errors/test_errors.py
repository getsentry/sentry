from sentry.monitors.processing_errors.errors import CheckinProcessingError, ProcessingErrorType
from sentry.monitors.testutils import build_checkin_item


def test_checkin_processing_error():
    item = build_checkin_item()
    error = CheckinProcessingError(
        [{"type": ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT, "reason": "Bad name"}],
        item,
    )
    recreated_error = CheckinProcessingError.from_dict(error.to_dict())
    assert error == recreated_error
