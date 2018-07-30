import itertools
import logging
from sentry.eventstream.kafka.protocol import parse_event_message
from sentry.tasks.post_process import post_process_group


# TODO: Figure out where the attributes for this constructor are coming from!
consumer = SynchronizedConsumer()
batch_size = 100

try:
    for i in itertools.count(1):
        message = consumer.poll(0.1)
        if message is None:
            continue

        error = message.error()
        if error is not None:
            raise Exception(error)

        payload = parse_event_message(message.value())
        if payload is not None:
            post_process_group.delay(**payload)

        if i % batch_size == 0:
            # TODO: Figure out exactly what the commit semantics are here --
            # does this need to commit every topic?
            raise NotImplementedError
except KeyboardInterrupt:
    logger.info('Stop requested, committing offsets and closing consumer...')
    consumer.close()
    break
