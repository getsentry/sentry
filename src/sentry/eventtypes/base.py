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

    def to_string(self, metadata):
        raise NotImplementedError


class DefaultEvent(BaseEvent):
    key = 'default'

    def has_metadata(self):
        # the default event can always work
        return True

    def get_metadata(self):
        # See GH-3248
        message_interface = self.data.get('sentry.interfaces.Message', {
            'message': self.data.get('message', ''),
        })
        message = strip(message_interface.get('formatted', message_interface['message']))
        if not message:
            title = '<unlabeled event>'
        else:
            title = truncatechars(message.splitlines()[0], 100)
        return {
            'title': title,
        }

    def to_string(self, metadata):
        return metadata['title']
