from __future__ import absolute_import, print_function

__all__ = ('Attribute', 'Event', 'Map')

import six

from collections import Mapping
from django.utils import timezone


class Attribute(object):
    __slots__ = ['name', 'type', 'required']

    def __init__(self, name, type=six.text_type, required=True):
        self.name = name
        self.type = type
        self.required = required


class Map(Attribute):
    def __init__(self, name, attributes, required=True):
        self.name = name
        self.required = required
        self.attributes = attributes

    def type(self, value):
        if not isinstance(value, Mapping):
            raise ValueError('Value must be a dictionary')

        # ensure we dont mutate the original
        # we dont need to deepcopy as if it recurses into another Map it
        # will once again copy itself
        items = value.copy()

        data = {}
        for attr in self.attributes:
            nv = items.pop(attr.name, None)
            if attr.required and nv is None:
                raise ValueError(u'{} is required (cannot be None)'.format(
                    attr.name,
                ))

            data[attr.name] = attr.type(nv) if nv is not None else nv

        if items:
            raise ValueError(u'Unknown attributes: {}'.format(
                ', '.join(map(six.text_type, six.iterkeys(items))),
            ))

        return data


class Event(object):
    __slots__ = ['attributes', 'data', 'datetime', 'type']

    type = None

    attributes = ()

    def __init__(self, type=None, datetime=None, **items):
        self.datetime = datetime or timezone.now()
        if type is not None:
            self.type = type

        if self.type is None:
            raise ValueError('Event is missing type')

        data = {}
        for attr in self.attributes:
            nv = items.pop(attr.name, None)
            if attr.required and nv is None:
                raise ValueError(u'{} is required (cannot be None)'.format(
                    attr.name,
                ))
            data[attr.name] = attr.type(nv) if nv is not None else nv

        if items:
            raise ValueError(u'Unknown attributes: {}'.format(
                ', '.join(six.iterkeys(items)),
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
