from __future__ import absolute_import

from collections import (Mapping, Set, Sequence)

import six

from sentry.interfaces.stacktrace import Frame


class Encoder(object):
    def __init__(self, types):
        self.types = types

    def dumps(self, value):
        for cls, function in self.types.items():
            if isinstance(value, cls):
                value = function(value)

        # TODO: This should also handle numbers.
        if isinstance(value, six.binary_type):
            return value
        elif isinstance(value, six.text_type):
            return value.encode('utf8')
        elif isinstance(value, Set):
            return '\x00'.join(
                sorted(
                    map(
                        self.dumps,
                        value,
                    ),
                )
            )
        elif isinstance(value, Sequence):
            return '\x01'.join(
                map(
                    self.dumps,
                    value,
                ),
            )
        elif isinstance(value, Mapping):
            return '\x02'.join(
                sorted(
                    '\x01'.join(
                        map(
                            self.dumps,
                            item,
                        )
                    ) for item in value.items(),
                ),
            )
        else:
            raise TypeError('Unsupported type: {}'.format(type(value)))


def get_frame_attributes(frame):
    attributes = {}

    if frame.function in set(['<lambda>', None]):
        attributes['signature'] = (
            (frame.pre_context or [])[-5:] +
            [frame.context_line] +
            (frame.post_context or [])[:5]
        )
    else:
        attributes['function'] = frame.function

    for name in ('module', 'filename'):
        value = getattr(frame, name)
        if value:
            attributes[name] = value
            break

    return attributes


encoder = Encoder({
    Frame: get_frame_attributes,
})
