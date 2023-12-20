from datetime import datetime

import pytest

from sentry.utils.kafka import delay_kafka_rebalance


@pytest.mark.parametrize("configured_delay", [5, 10, 15])
def test_delay_tick(configured_delay) -> None:
    initial = datetime.now()
    initial_sec = float(initial.strftime("%S.%f"))

    delay_kafka_rebalance(configured_delay)

    after_delay = datetime.now()

    # by the time we assert, the exact millisecond time
    # will be slightly past the 15-second tick
    # so we only want second precision here
    after_delay_sec = int(after_delay.strftime("%S"))

    assert after_delay_sec % configured_delay == 0

    tick, remainder = divmod(initial_sec, configured_delay)

    # case of immediate rebalance
    if remainder == 0.0:
        assert after_delay_sec == configured_delay * tick

    # case of delayed rebalance
    else:
        assert after_delay_sec == (configured_delay * (tick + 1)) % 60
