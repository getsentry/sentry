from __future__ import annotations

from typing import int, TypedDict


class ServiceOptions(TypedDict, total=False):
    path: str
    options: dict[str, object]
    executor: ServiceOptions
