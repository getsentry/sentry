from __future__ import absolute_import


from sentry.eventstore.base import EventStorage


class SnubaEventStorage(EventStorage):
    """
    Eventstore backend backed by Snuba
    """
