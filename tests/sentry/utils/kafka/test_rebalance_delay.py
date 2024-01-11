import time

import pytest

from sentry.utils.kafka import delay_kafka_rebalance


@pytest.mark.parametrize("configured_delay", [5, 10, 15])
def test_delay_tick(configured_delay) -> None:
    delay_kafka_rebalance(configured_delay)

    after_delay_sec = int(time.time())

    assert after_delay_sec % configured_delay == 0
