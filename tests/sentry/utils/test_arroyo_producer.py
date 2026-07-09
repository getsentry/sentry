from unittest.mock import Mock, patch

from arroyo.backends.kafka import KafkaProducer

from sentry.utils.arroyo_producer import SingletonProducer


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
