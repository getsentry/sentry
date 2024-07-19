from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sentry.analytics.attribute import Attribute


def get_data(attributes: Sequence[Attribute], items: dict[str, Any]) -> Mapping[str, Any | None]:
    data = {}
    for attr in attributes:
        nv = items.pop(attr.name, None)
        if attr.required and nv is None:
            raise ValueError(f"{attr.name} is required (cannot be None)")
        data[attr.name] = attr.extract(nv)

    if items:
        raise ValueError("Unknown attributes: {}".format(", ".join(items.keys())))

    return data
