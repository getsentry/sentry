from sentry.integrations.types import EventLifecycleOutcome

"""
Helper functions to assert integration SLO metrics
"""


def assert_halt_metric(mock_record, error_msg):
    (event_halts,) = (
        call for call in mock_record.mock_calls if call.args[0] == EventLifecycleOutcome.HALTED
    )
    if isinstance(error_msg, Exception):
        assert isinstance(event_halts.args[1], type(error_msg))
    else:
        assert event_halts.args[1] == error_msg


def assert_failure_metric(mock_record, error_msg):
    (event_failures,) = (
        call for call in mock_record.mock_calls if call.args[0] == EventLifecycleOutcome.FAILURE
    )
    if isinstance(error_msg, Exception):
        assert isinstance(event_failures.args[1], type(error_msg))
    else:
        assert event_failures.args[1] == error_msg
