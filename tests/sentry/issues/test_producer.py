from unittest.mock import Mock

from django.test.utils import override_settings

from sentry.issues.producer import track_occurrence_producer_futures


def test_track_occurrence_producer_futures() -> None:
    future_mock = Mock()
    future_mock.result = Mock()
    track_occurrence_producer_futures(future_mock)
    future_mock.result.assert_called_once_with()


@override_settings(SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT=2)  # type: ignore
def test_track_occurrence_producer_futures_with_multiple() -> None:
    first_future_mock = Mock()
    first_future_mock.result = Mock()

    second_future_mock = Mock()
    second_future_mock.result = Mock()

    track_occurrence_producer_futures(first_future_mock)
    first_future_mock.result.assert_not_called()

    track_occurrence_producer_futures(second_future_mock)
    first_future_mock.result.assert_called_once_with()
    second_future_mock.assert_not_called()
