from __future__ import absolute_import

from sentry.utils.services import Service

from sentry.tasks.post_process import post_process_group


class EventStream(Service):
    __all__ = (
        'publish',
    )

    def publish(self, event, primary_hash, **kwargs):
        post_process_group.delay(event=event, primary_hash=primary_hash, **kwargs)
