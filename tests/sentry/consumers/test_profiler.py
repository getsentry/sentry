from typing import int
from unittest.mock import Mock

from sentry.consumers import JoinProfilerStrategyFactoryWrapper


def test_join_profiler() -> None:
    inner_factory_mock = Mock()
    inner_strategy_mock = Mock()
    inner_factory_mock.create_with_partitions = Mock(return_value=inner_strategy_mock)

    factory = JoinProfilerStrategyFactoryWrapper(inner_factory_mock)
    strategy = factory.create_with_partitions(Mock(), Mock())

    strategy.join()
    inner_strategy_mock.join.assert_called_once()
