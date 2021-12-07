from sentry.utils.compat import map

__all__ = ("Attribute", "Event", "Map")

from typing import Any, Sequence
from base64 import b64encode
from collections.abc import Mapping
from dataclasses import dataclass
from uuid import uuid1

from django.utils import timezone

from sentry.utils.dates import to_timestamp


class Event(abc.ABC):
    __slots__ = ["uuid", "data", "datetime"]

    type = None

    attributes = ()

    def __init__(self, type=None, datetime=None, **items):
        self.uuid = uuid1()

        self.datetime = datetime or timezone.now()
        if type is not None:
            self.type = type
        self.data = get_data(self.attributes, items)

        if self.type is None:
            raise ValueError("Event is missing type")


    def serialize(self) -> Mapping[str, Any]:
        return {
            "uuid": b64encode(self.uuid.bytes),
            "timestamp": to_timestamp(self.datetime),
            "type": self.type,
            "data": self.data,
        }

    @classmethod
    def from_instance(cls, instance: Any, **kwargs: Any) -> Event:
        values = {}
        for attr in cls.attributes:
            values[attr.name] = kwargs.get(attr.name, getattr(instance, attr.name, None))
        return cls(**values)
