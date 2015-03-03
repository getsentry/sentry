from __future__ import absolute_import, print_function

import inspect
import logging

from django.conf import settings
from raven.contrib.django.client import DjangoClient

UNSAFE_FILES = (
    'sentry/event_manager.py',
    'sentry/tasks/process_buffer.py',
)


def can_record_current_event():
    """
    Tests the current stack for unsafe locations that would likely cause
    recursion if an attempt to send to Sentry was made.
    """
    for _, filename, _, _, _, _ in inspect.stack():
        if filename.endswith(UNSAFE_FILES):
            return True
    return False


class SentryInternalClient(DjangoClient):
    def is_enabled(self):
        if getattr(settings, 'DISABLE_RAVEN', False):
            return False
        return settings.SENTRY_PROJECT is not None

    def send(self, **kwargs):
        from sentry.coreapi import insert_data_to_database
        from sentry.event_manager import EventManager

        if not can_record_current_event():
            pass

        # TODO(dcramer): this should respect rate limits/etc and use the normal
        # pipeline
        try:
            manager = EventManager(kwargs)
            data = manager.normalize()
            insert_data_to_database(data)
        except Exception as e:
            if self.raise_send_errors:
                raise
            self.error_logger.error(
                'Unable to record event: %s\nEvent was: %r', e,
                kwargs['message'], exc_info=True)


class SentryInternalFilter(logging.Filter):
    def filter(self, record):
        return not can_record_current_event()
