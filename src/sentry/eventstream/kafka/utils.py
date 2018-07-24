from __future__ import absolute_import


def join(consumers, timeout=0.0, throttle=0.1):
    """
    Creates an iterator that can be used to consume from multiple independent
    Kafka consumers.

    - The ``timeout`` will be used as the poll interval for each message,
      allowing for rapid consumption when consumers are receving messages at a
      high rate.
    - The ``throttle`` value will be added to the ``timeout`` value if none of
      the consumers returned a message on the last iteration through the loop
      (avoiding busy waiting.)
    """
    i = 0
    while True:
        for consumer in consumers:
            message = consumer.poll(timeout if i < len(consumers) else timeout + throttle)
            if message is None:
                i = min(i + 1, len(consumers))
                continue

            error = message.error()
            if error is not None:
                raise Exception(error)

            yield (consumer, message)
            i = 0
