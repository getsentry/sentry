from __future__ import absolute_import

from sentry.utils.services import Service


class EventStream(Service):
    __all__ = (
        'publish',
    )

    def publish(self, event, primary_hash, **kwargs):
        return
