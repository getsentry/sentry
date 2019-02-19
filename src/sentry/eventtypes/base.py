from __future__ import absolute_import

from warnings import warn

from sentry.utils.strings import truncatechars, strip
from sentry.utils.safe import get_path
from sentry.constants import MAX_CULPRIT_LENGTH


class BaseEvent(object):
    id = None

    def has_metadata(self, data):
        raise NotImplementedError

    def get_metadata(self, data):
        return {
            'culprit': self.generate_culprit_for_data(data),
        }

    def generate_culprit_for_data(self, data):
        # If a value has been forced by the client we use that one.
        forced = data.get('culprit') or data.get('transaction')
        if forced:
            return forced

        exceptions = get_path(data, 'exception', 'values')
        if exceptions:
            stacktraces = [e['stacktrace']
                           for e in exceptions if get_path(e, 'stacktrace', 'frames')]
        else:
            stacktrace = data.get('stacktrace')
            if stacktrace and stacktrace.get('frames'):
                stacktraces = [stacktrace]
            else:
                stacktraces = None

        culprit = None

        if not culprit and stacktraces:
            from sentry.interfaces.stacktrace import Stacktrace
            culprit = Stacktrace.to_python(stacktraces[-1]).get_culprit_string(
                platform=data.get('platform'),
            )

        if not culprit and data.get('request'):
            culprit = get_path(data, 'request', 'url')

        return truncatechars(culprit or '', MAX_CULPRIT_LENGTH)

    def get_title(self, metadata):
        raise NotImplementedError

    def get_location(self, metadata):
        return None

    def to_string(self, metadata):
        warn(DeprecationWarning('This method was replaced by get_title',
                                stacklevel=2))
        return self.get_title()

    def get_culprit(self, metadata):
        return metadata.get('culprit')


class DefaultEvent(BaseEvent):
    key = 'default'

    def has_metadata(self, data):
        # the default event can always work
        return True

    def get_metadata(self, data):
        rv = BaseEvent.get_metadata(self, data)
        message = strip(get_path(data, 'logentry', 'formatted') or
                        get_path(data, 'logentry', 'message'))

        if message:
            title = truncatechars(message.splitlines()[0], 100)
        else:
            title = '<unlabeled event>'
        rv['title'] = title
        return rv

    def get_title(self, metadata):
        return metadata['title']
