from sentry.utils.compat import map

__all__ = ("Attribute", "Event", "Map")

from base64 import b64encode
from collections.abc import Mapping
from uuid import uuid1

from django.utils import timezone

from sentry.utils.dates import to_timestamp


class Attribute:
    def __init__(self, name, type=str, required=True):
        self.name = name
        self.type = type
        self.required = required

    def extract(self, value):
        if value is None:
            return value
        return self.type(value)


class Map(Attribute):
    def __init__(self, name, attributes=None, required=True):
        self.name = name
        self.required = required
        self.attributes = attributes

    def extract(self, value):
        """
        If passed a non dictionary we assume we can pull attributes from it.

        This will hard error in some situations if you're passing a bad type
        (like an int).
        """
        if value is None:
            return value

        if not isinstance(value, Mapping):
            new_value = {}
            for attr in self.attributes:
                new_value[attr.name] = attr.extract(getattr(value, attr.name, None))
            items = new_value
        else:
            # ensure we don't mutate the original
            # we don't need to deepcopy as if it recurses into another Map it
            # will once again copy itself
            items = value.copy()

        data = {}
        for attr in self.attributes:
            nv = items.pop(attr.name, None)
            if attr.required and nv is None:
                raise ValueError(f"{attr.name} is required (cannot be None)")

            data[attr.name] = attr.extract(nv)

        if items:
            raise ValueError("Unknown attributes: {}".format(", ".join(map(str, items.keys()))))

        return data


class Event:
    __slots__ = ["uuid", "data", "datetime"]

    type = None

    attributes = ()

    def __init__(self, type=None, datetime=None, **items):
        self.uuid = uuid1()

        self.datetime = datetime or timezone.now()
        if type is not None:
            self.type = type

        if self.type is None:
            raise ValueError("Event is missing type")

        data = {}
        for attr in self.attributes:
            nv = items.pop(attr.name, None)
            if attr.required and nv is None:
                raise ValueError(f"{attr.name} is required (cannot be None)")
            data[attr.name] = attr.extract(nv)

        if items:
            raise ValueError("Unknown attributes: {}".format(", ".join(items.keys())))

        self.data = data

    def serialize(self):
        return {
            "uuid": b64encode(self.uuid.bytes),
            "timestamp": to_timestamp(self.datetime),
            "type": self.type,
            "data": self.data,
        }

    @classmethod
    def from_instance(cls, instance, **kwargs):
        values = {}
        for attr in cls.attributes:
            values[attr.name] = kwargs.get(attr.name, getattr(instance, attr.name, None))
        return cls(**values)
