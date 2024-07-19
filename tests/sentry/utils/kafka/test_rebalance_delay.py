import time
from unittest import mock

import pytest

from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.kafka import delay_kafka_rebalance


@pytest.fixture
def frozen_time_with_warp():
    with freeze_time() as frozen:
        with mock.patch.object(time, "sleep", frozen.shift):
            yield


@pytest.mark.usefixtures("frozen_time_with_warp")
@pytest.mark.parametrize("configured_delay", [5, 10, 15])
def test_delay_tick(configured_delay) -> None:
    delay_kafka_rebalance(configured_delay)

    after_delay_sec = int(time.time())

    assert after_delay_sec % configured_delay == 0
