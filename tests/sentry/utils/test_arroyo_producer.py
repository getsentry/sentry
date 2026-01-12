from unittest.mock import Mock

from arroyo.backends.kafka import KafkaProducer

from sentry.utils.arroyo_producer import SingletonProducer


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


def test_producer_reinitializes_after_shutdown() -> None:
    """Test that producer reinitializes after being closed by atexit handler."""
    call_count = 0

    def producer_factory() -> KafkaProducer:
        nonlocal call_count
        call_count += 1
        mock_producer = Mock(spec=KafkaProducer)
        mock_producer.produce = Mock(return_value=Mock())
        mock_producer.close = Mock()
        return mock_producer

    producer = SingletonProducer(producer_factory, max_futures=1000)

    # First produce should initialize the producer
    mock_destination = Mock()
    mock_payload = Mock()
    producer.produce(mock_destination, mock_payload)
    assert call_count == 1
    assert producer._producer is not None
    assert not producer._is_closed

    # Simulate atexit handler being called prematurely
    producer._shutdown()
    assert producer._is_closed
    assert producer._producer is None

    # Next produce should reinitialize the producer
    producer.produce(mock_destination, mock_payload)
    assert call_count == 2  # Producer factory called again
    assert producer._producer is not None
    assert not producer._is_closed


def test_atexit_registered_only_once() -> None:
    """Test that atexit handler is registered only once even after reinitialization."""
    import atexit

    call_count = 0

    def producer_factory() -> KafkaProducer:
        nonlocal call_count
        call_count += 1
        mock_producer = Mock(spec=KafkaProducer)
        mock_producer.produce = Mock(return_value=Mock())
        mock_producer.close = Mock()
        return mock_producer

    producer = SingletonProducer(producer_factory, max_futures=1000)

    # Track atexit registrations
    original_register = atexit.register
    registration_count = 0

    def counting_register(func):
        nonlocal registration_count
        if func == producer._shutdown:
            registration_count += 1
        return original_register(func)

    atexit.register = counting_register

    try:
        # First produce
        mock_destination = Mock()
        mock_payload = Mock()
        producer.produce(mock_destination, mock_payload)
        assert registration_count == 1

        # Simulate shutdown and reinitialize
        producer._shutdown()
        producer.produce(mock_destination, mock_payload)
        # Should still be 1 - not registered again
        assert registration_count == 1
    finally:
        atexit.register = original_register
