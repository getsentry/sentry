from __future__ import absolute_import

from sentry.utils.strings import truncatechars, strip
from sentry.utils.meta import get_valid


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
        message = get_valid(self.data, 'logentry', 'formatted') \
            or get_valid(self.data, 'logentry', 'message')

        if not message:
            title = '<unlabeled event>'
        else:
            title = truncatechars(strip(message).splitlines()[0], 100)

        return {
            'title': title,
        }

    def to_string(self, metadata):
        return metadata['title']
