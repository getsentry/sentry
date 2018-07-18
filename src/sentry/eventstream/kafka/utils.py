from __future__ import absolute_import


def join(consumers, timeout=0.0, throttle=0.1):
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
