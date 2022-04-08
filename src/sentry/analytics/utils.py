from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Sequence

from django.conf import settings

from sentry.analytics.attribute import Attribute


def get_backend_path(backend_: str) -> str:
    try:
        backend_ = settings.SENTRY_ANALYTICS_ALIASES[backend_]
    except KeyError:
        pass
    return backend_


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
