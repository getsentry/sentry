from __future__ import absolute_import

from sentry.utils.strings import truncatechars, strip


class BaseEvent(object):
    id = None

    def __init__(self, data):
        self.data = data

    def has_metadata(self):
        raise NotImplementedError

    def get_metadata(self):
        raise NotImplementedError


class DefaultEvent(BaseEvent):
    key = 'default'

    def has_metadata(self):
        # the default event can always work
        return True

    def get_metadata(self):
        message = strip(self.data.get('message'))
        if not message:
            title = '<unlabeled event>'
        else:
            title = truncatechars(message.splitlines()[0], 100)
        return {
            'title': title,
        }
