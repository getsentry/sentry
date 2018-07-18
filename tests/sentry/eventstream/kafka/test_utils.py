from __future__ import absolute_import

import mock

from sentry.eventstream.kafka.relay import join


def test_join_single_consumer():
    consumer = mock.MagicMock()

    message = mock.Mock()
    message.error.return_value = None

    consumer.poll.side_effect = [None, None, message]

    joined_consumer = join([consumer])
    assert next(joined_consumer) == (consumer, message)

    assert consumer.poll.mock_calls == [
        mock.call(0.0),  # not throttled
        mock.call(0.1),  # throttled, no return value
        mock.call(0.1),  # throttled, returned message
    ]


def test_join_multiple_consumers():
    consumer_a = mock.MagicMock()
    consumer_b = mock.MagicMock()

    message = mock.Mock()
    message.error.return_value = None

    consumer_a.poll.side_effect, consumer_b.poll.side_effect = zip(*[
        (None, message),
        (None, None),
        (message, None),
        (message, message),
    ])

    joined_consumers = join([consumer_a, consumer_b])
    assert next(joined_consumers) == (consumer_b, message)
    assert next(joined_consumers) == (consumer_a, message)
    assert next(joined_consumers) == (consumer_a, message)
    assert next(joined_consumers) == (consumer_b, message)

    assert consumer_a.poll.mock_calls == [
        mock.call(0.0),  # not throttled
        mock.call(0.0),  # not throttled
        mock.call(0.1),  # throttled, returned message
        mock.call(0.0),  # not throttled, returned message
    ]

    assert consumer_b.poll.mock_calls == [
        mock.call(0.0),  # not throttled
        mock.call(0.0),  # not throttled
        mock.call(0.0),  # not throttled, returned message
        mock.call(0.0),  # not throttled, returned message
    ]
