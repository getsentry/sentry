from __future__ import annotations

import datetime as dt
from base64 import b64encode
from collections.abc import Mapping
from typing import Any, Sequence
from uuid import uuid1

from django.utils import timezone

from sentry.analytics.attribute import Attribute
from sentry.analytics.utils import get_data
from sentry.utils.dates import to_timestamp


class Event:
    __slots__ = ["uuid", "data", "datetime"]

    # This MUST be overridden by child classes.
    type = None

    # These should be overridden by child classes.
    attributes: Sequence[Attribute] = ()

    def __init__(
        self, type: Any | None = None, datetime: dt.datetime | None = None, **items: Any
    ) -> None:
        self.uuid = uuid1()
        self.datetime = datetime or timezone.now()
        self.type = self._get_type(type)  # type: ignore[misc]
        self.data = get_data(self.attributes, items)

    def _get_type(self, _type: Any | None = None) -> Any:
        """
        The Event's `type` can either be passed in as a parameter or set as a
        property on a child class.
        """
        if _type is not None:
            return _type

        if self.type is None:
            raise ValueError("Event is missing type")

        return self.type

    def serialize(self) -> Mapping[str, Any]:
        return {
            "uuid": b64encode(self.uuid.bytes),
            "timestamp": to_timestamp(self.datetime),
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
