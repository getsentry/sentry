from unittest import mock

import pytest
from google.api_core.exceptions import ServiceUnavailable

from sentry.services.filestore.gcs import GCS_RETRIES, GCS_RETRY_MAX_DELAY, try_repeated


def test_try_repeated_succeeds_without_sleeping() -> None:
    func = mock.Mock(return_value="ok")

    with mock.patch("sentry.services.filestore.gcs.time.sleep") as sleep:
        assert try_repeated(func) == "ok"

    assert func.call_count == 1
    assert sleep.call_count == 0


def test_try_repeated_sleeps_between_retries_then_succeeds() -> None:
    func = mock.Mock(side_effect=[ServiceUnavailable("503"), "ok"])

    with mock.patch("sentry.services.filestore.gcs.time.sleep") as sleep:
        assert try_repeated(func) == "ok"

    assert func.call_count == 2
    # One backoff between the failed attempt and the successful retry.
    assert sleep.call_count == 1
    assert sleep.call_args[0][0] >= 0


def test_try_repeated_backs_off_on_every_retry_before_raising() -> None:
    func = mock.Mock(side_effect=ServiceUnavailable("503"))

    with mock.patch("sentry.services.filestore.gcs.time.sleep") as sleep:
        with pytest.raises(ServiceUnavailable):
            try_repeated(func)

    # Initial attempt + GCS_RETRIES retries, with a backoff before each retry.
    assert func.call_count == GCS_RETRIES + 1
    assert sleep.call_count == GCS_RETRIES
    # Full jitter keeps every backoff within [0, GCS_RETRY_MAX_DELAY].
    for call in sleep.call_args_list:
        assert 0 <= call.args[0] <= GCS_RETRY_MAX_DELAY
