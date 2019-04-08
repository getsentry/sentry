from __future__ import absolute_import

import six

from sentry.utils.safe import get_path, trim
from sentry.utils.strings import truncatechars

from .base import BaseEvent


def get_crash_location(exception, platform=None):
    default = None
    for frame in reversed(get_path(exception, 'stacktrace', 'frames', filter=True) or ()):
        fn = frame.get('filename') or frame.get('abs_path')
        if fn:
            func = frame.get('function')
            if func is not None:
                from sentry.grouping.strategies.utils import trim_function_name
                func = trim_function_name(func, frame.get('platform') or platform)
            if frame.get('in_app'):
                return fn, func
            if default is None:
                default = fn, func
    return default


class ErrorEvent(BaseEvent):
    key = 'error'

    def has_metadata(self, data):
        exception = get_path(data, 'exception', 'values', -1)
        return exception and any(v is not None for v in six.itervalues(exception))

    def get_metadata(self, data):
        exception = get_path(data, 'exception', 'values', -1)
        if not exception:
            return {}

        loc = get_crash_location(exception, data.get('platform'))
        rv = {
            'value': trim(get_path(exception, 'value', default=''), 1024),
        }

        # If the exception mechanism indicates a synthetic exception we do not
        # want to record the type and value into the metadata.
        if not get_path(exception, 'mechanism', 'synthetic'):
            rv['type'] = trim(get_path(exception, 'type', default='Error'), 128)

        # Attach crash location if available
        if loc is not None:
            fn, func = loc
            if fn:
                rv['filename'] = fn
            if func:
                rv['function'] = func

        return rv

    def get_title(self, metadata):
        ty = metadata.get('type')
        if ty is None:
            return metadata.get('function') or '<unknown>'
        if not metadata.get('value'):
            return ty
        return u'{}: {}'.format(
            ty,
            truncatechars(metadata['value'].splitlines()[0], 100),
        )

    def get_location(self, metadata):
        return metadata.get('filename')
