from unittest.mock import Mock, patch

from sentry.consumers import JoinProfilerStrategyFactoryWrapper


@patch("sentry_sdk.init")
@patch("sentry_sdk.start_transaction")
def test_join_profiler(mock_init: Mock, mock_transaction) -> None:
    inner_factory_mock = Mock()
    inner_strategy_mock = Mock()
    inner_factory_mock.create_with_partitions = Mock(return_value=inner_strategy_mock)

    factory = JoinProfilerStrategyFactoryWrapper(inner_factory_mock)
    strategy = factory.create_with_partitions(Mock(), Mock())

    strategy.join()
    inner_strategy_mock.join.assert_called_once()
