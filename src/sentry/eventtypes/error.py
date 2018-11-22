from __future__ import absolute_import

import six

from sentry.utils.safe import get_path, trim
from sentry.utils.strings import truncatechars

from .base import BaseEvent


def get_crash_file(stacktrace):
    default = None
    for frame in reversed(stacktrace.get('frames') or ()):
        fn = frame.get('filename') or frame.get('abs_path')
        if fn:
            if frame.get('in_app'):
                return fn
            if default is None:
                default = fn
    return default


class ErrorEvent(BaseEvent):
    key = 'error'

    def has_metadata(self):
        exception = get_path(self.data, 'exception', 'values', -1)
        return exception and any(v is not None for v in six.itervalues(exception))

    def get_metadata(self):
        exception = get_path(self.data, 'exception', 'values', -1)

        # in some situations clients are submitting non-string data for these
        rv = {
            'type': trim(get_path(exception, 'type', default='Error'), 128),
            'value': trim(get_path(exception, 'value', default=''), 1024),
        }

        # Attach crash location
        stacktrace = exception.get('stacktrace')
        if stacktrace:
            fn = get_crash_file(stacktrace)
            if fn is not None:
                rv['filename'] = fn

        return rv

    def to_string(self, metadata):
        if not metadata['value']:
            return metadata['type']
        return u'{}: {}'.format(
            metadata['type'],
            truncatechars(metadata['value'].splitlines()[0], 100),
        )
