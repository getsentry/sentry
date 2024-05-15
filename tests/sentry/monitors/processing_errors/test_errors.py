from sentry.monitors.processing_errors.errors import (
    CheckinProcessingError,
    ProcessingError,
    ProcessingErrorType,
)
from sentry.monitors.testutils import build_checkin_item


def test_processing_error():
    error = ProcessingError(ProcessingErrorType.CHECKIN_INVALID_GUID, {"some": "data"})
    recreated_error = ProcessingError.from_dict(error.to_dict())
    assert recreated_error.type == error.type
    assert recreated_error.data == error.data


def test_checkin_processing_error():
    item = build_checkin_item()
    error = CheckinProcessingError(
        [ProcessingError(ProcessingErrorType.MONITOR_DISABLED, {"some": "data"})],
        item,
    )
    recreated_error = CheckinProcessingError.from_dict(error.to_dict())
    assert error == recreated_error
