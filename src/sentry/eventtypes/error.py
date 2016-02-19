from __future__ import absolute_import

from .base import BaseEvent


class ErrorEvent(BaseEvent):
    key = 'error'

    def has_metadata(self):
        return 'sentry.interfaces.Exception' in self.data

    def get_metadata(self):
        exception = self.data['sentry.interfaces.Exception']['values'][0]

        return {
            'type': exception.get('type', 'Error'),
            'value': exception.get('value', ''),
        }
