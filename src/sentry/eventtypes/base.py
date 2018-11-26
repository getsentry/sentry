from __future__ import absolute_import

from sentry.utils.strings import truncatechars, strip
from sentry.utils.safe import get_path


class BaseEvent(object):
    id = None

    def __init__(self, data):
        self.data = data

    def has_metadata(self):
        raise NotImplementedError

    def get_metadata(self):
        raise NotImplementedError

    def to_string(self, metadata):
        raise NotImplementedError


class DefaultEvent(BaseEvent):
    key = 'default'

    def has_metadata(self):
        # the default event can always work
        return True

    def get_metadata(self):
        message = strip(get_path(self.data, 'logentry', 'formatted') or
                        get_path(self.data, 'logentry', 'message'))

        if message:
            title = truncatechars(message.splitlines()[0], 100)
        else:
            title = '<unlabeled event>'

        return {
            'title': title,
        }

    def to_string(self, metadata):
        return metadata['title']
