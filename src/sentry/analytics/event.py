from __future__ import annotations

import datetime as dt
from base64 import b64encode
from collections.abc import Mapping, Sequence
from typing import Any
from uuid import uuid1

from django.utils import timezone

from sentry.analytics.attribute import Attribute
from sentry.analytics.utils import get_data


class Event:
    __slots__ = ("uuid", "data", "datetime")

    # These should be overridden by child classes.
    type: str  # abstract
    attributes: Sequence[Attribute] = ()

    def __init__(self, datetime: dt.datetime | None = None, **items: Any) -> None:
        self.uuid = uuid1()
        self.datetime = datetime or timezone.now()
        self.data = get_data(self.attributes, items)

    def serialize(self) -> Mapping[str, Any]:
        return {
            "uuid": b64encode(self.uuid.bytes),
            "timestamp": self.datetime.timestamp(),
            "type": self.type,
            "data": self.data,
        }

    @classmethod
    def from_instance(cls, instance: Any, **kwargs: Any) -> Event:
        return cls(
            **{
                attr.name: kwargs.get(attr.name, getattr(instance, attr.name, None))
                for attr in cls.attributes
            }
        )
