from __future__ import absolute_import

from sentry.utils.safe import trim
from sentry.utils.strings import truncatechars

from .base import BaseEvent


class ErrorEvent(BaseEvent):
    key = 'error'

    def has_metadata(self):
        return 'sentry.interfaces.Exception' in self.data

    def get_metadata(self):
        try:
            exception = self.data['sentry.interfaces.Exception']['values'][-1]
            type = exception.get('type', None)
            value = exception.get('value', None)
        except Exception:
            type = value = None

        type = type or 'Error'
        if not value:
            message = self.data.get('sentry.interfaces.Message', None)
            if message and 'message' in message:
                value = message['message']
            else:
                value = ''

        # in some situations clients are submitting non-string data for these
        return {
            'type': trim(type, 128),
            'value': trim(value, 1024),
        }

    def to_string(self, metadata):
        if not metadata['value']:
            return metadata['type']
        return u'{}: {}'.format(
            metadata['type'],
            truncatechars(metadata['value'].splitlines()[0], 100),
        )
