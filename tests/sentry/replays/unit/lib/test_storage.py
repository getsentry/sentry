from collections.abc import Generator
from unittest import mock

import pytest
from google.api_core.exceptions import BadGateway, ServiceUnavailable

from sentry.replays.lib.storage import REPLAY_UPLOAD_BAD_GATEWAY_RETRIES, storage_kv


@pytest.fixture
def storage() -> Generator[mock.Mock]:
    storage = mock.Mock()
    with (
        mock.patch("sentry.replays.lib.storage.get_storage", return_value=storage),
        mock.patch.object(storage_kv, "_make_storage_options", return_value=None),
        mock.patch("sentry.utils.retries.time.sleep"),
    ):
        yield storage


def test_set_retries_bad_gateway(storage: mock.Mock) -> None:
    storage.save.side_effect = [BadGateway("502"), "key"]

    storage_kv.set("key", b"value")

    assert storage.save.call_count == 2


def test_set_raises_bad_gateway_after_retry_limit(storage: mock.Mock) -> None:
    storage.save.side_effect = BadGateway("502")

    with pytest.raises(BadGateway):
        storage_kv.set("key", b"value")

    assert storage.save.call_count == REPLAY_UPLOAD_BAD_GATEWAY_RETRIES + 1


def test_set_does_not_retry_other_errors(storage: mock.Mock) -> None:
    # Other transient errors are retried by the storage backend's own policy.
    storage.save.side_effect = ServiceUnavailable("503")

    with pytest.raises(ServiceUnavailable):
        storage_kv.set("key", b"value")

    assert storage.save.call_count == 1
