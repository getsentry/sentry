from __future__ import absolute_import, print_function

from django.conf import settings
from raven.contrib.django.client import DjangoClient

from sentry.coreapi import insert_data_to_database
from sentry.event_manager import EventManager


class SentryInternalClient(DjangoClient):
    def is_enabled(self):
        if getattr(settings, 'DISABLE_RAVEN', False):
            return False
        return settings.SENTRY_PROJECT is not None

    def send(self, **kwargs):
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
