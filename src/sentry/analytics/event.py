from __future__ import absolute_import, print_function

import six

from django.utils import timezone


class Attribute(object):
    __slots__ = ['name', 'type', 'required']

    def __init__(self, name, type=six.text_type, required=True):
        self.name = name
        self.type = type
        self.required = required


class Event(object):
    __slots__ = ['attributes', 'data', 'datetime', 'type']

    type = None

    attributes = ()

    def __init__(self, type=None, datetime=None, **kwargs):
        self.datetime = datetime or timezone.now()
        if type is not None:
            self.type = type

        if self.type is None:
            raise ValueError('Event is missing type')

        data = {}
        for attr in self.attributes:
            if attr.required:
                value = kwargs.pop(attr.name)
            else:
                value = kwargs.pop(attr.name, None)
            data[attr.name] = attr.type(value) if value is not None else value

        if kwargs:
            raise ValueError(u'Unknown attributes: {}'.format(
                ', '.join(kwargs.keys()),
            ))

        self.data = data

    def serialize(self):
        return dict({
            'timestamp': int(self.datetime.isoformat('%s')),
            'type': self.type,
        }, **self.data)

    @classmethod
    def from_instance(cls, instance, **kwargs):
        values = {}
        for attr in cls.attributes:
            values[attr.name] = (
                kwargs.get(attr.name) or
                getattr(instance, attr.name, None)
            )
        return cls(**values)
