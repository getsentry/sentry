from __future__ import absolute_import

from sentry.eventstream.kafka.consumer import SynchronizedConsumer
from sentry.eventstream.kafka.protocol import parse_event_message
from sentry.tasks.post_process import post_process_group


class RelayConsumer(SynchronizedConsumer):
    def handle(self, message):
        task_kwargs = parse_event_message(message.value())
        if task_kwargs is not None:
            post_process_group.delay(**task_kwargs)
        # TODO: It's probably excessive to commit after every message, right?
        self.commit(message=message)
