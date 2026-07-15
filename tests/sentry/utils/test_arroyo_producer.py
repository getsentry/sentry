from unittest.mock import Mock, patch

from arroyo.backends.kafka import KafkaProducer

from sentry.testutils.asserts import assert_mock_called_once_with_partial
from sentry.testutils.helpers.options import override_options
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer


def test_registers_shutdown_at_construction() -> None:
    # The shutdown must be registered eagerly (not on first produce) so atexit's
    # LIFO ordering runs it after anything that flushes into the producer at exit.
    def dummy_producer() -> KafkaProducer:
        raise AssertionError("no producer")

    with patch("sentry.utils.arroyo_producer.atexit.register") as register:
        producer = SingletonProducer(dummy_producer)

    register.assert_called_once_with(producer._shutdown)


def test_shutdown_is_noop_without_producer() -> None:
    # A producer that is never used must shut down cleanly.
    def dummy_producer() -> KafkaProducer:
        raise AssertionError("no producer")

    producer = SingletonProducer(dummy_producer)
    producer._shutdown()


def test_track_futures() -> None:
    def dummy_producer() -> KafkaProducer:
        raise AssertionError("no producer")

    producer = SingletonProducer(dummy_producer, max_futures=2)

    first_future_mock = Mock()
    first_future_mock.result = Mock()

    second_future_mock = Mock()
    second_future_mock.result = Mock()

    producer._track_futures(first_future_mock)
    first_future_mock.result.assert_not_called()
    producer._track_futures(second_future_mock)
    first_future_mock.result.assert_called_once_with()
    second_future_mock.assert_not_called()


@override_options(
    {
        "arroyo.producer.record_poll_metrics": ["producer.fake"],
        "arroyo.producer.poll_metric_frequency": 1,
    }
)
@patch("sentry.utils.arroyo_producer.KafkaProducer")
@patch("sentry.utils.arroyo_producer.build_kafka_producer_configuration")
def test_poll_metrics(mock_build_config: Mock, mock_producer: Mock) -> None:
    get_arroyo_producer("producer.fake", "fake-topic")
    assert_mock_called_once_with_partial(
        mock_producer, record_poll_metrics=True, poll_metric_frequency=1
    )


@override_options(
    {
        "arroyo.producer.record_poll_metrics": [],
        "arroyo.producer.poll_metric_frequency": 1,
    }
)
@patch("sentry.utils.arroyo_producer.KafkaProducer")
@patch("sentry.utils.arroyo_producer.build_kafka_producer_configuration")
def test_poll_metrics_not_enabled(mock_build_config: Mock, mock_producer: Mock) -> None:
    get_arroyo_producer("producer.fake", "fake-topic")
    assert_mock_called_once_with_partial(
        mock_producer, record_poll_metrics=False, poll_metric_frequency=1
    )
