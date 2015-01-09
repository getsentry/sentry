from __future__ import absolute_import, print_function

from django.conf import settings
from django.db import transaction
from raven.contrib.django.client import DjangoClient

from sentry.event_manager import EventManager


class SentryInternalClient(DjangoClient):
    def is_enabled(self):
        return settings.SENTRY_PROJECT is not None

    def send(self, project, **kwargs):
        if transaction.is_dirty():
            transaction.rollback()

        try:
            manager = EventManager(kwargs)
            manager.normalize()
            print ('here')
            return manager.save(project)
        except Exception as e:
            if self.raise_send_errors:
                raise
            self.error_logger.error(
                'Unable to record event: %s\nEvent was: %r', e,
                kwargs['message'], exc_info=True)
