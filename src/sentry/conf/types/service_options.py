from __future__ import annotations

from typing import NotRequired, TypedDict


class ServiceOptions(TypedDict):
    path: NotRequired[str]
    options: NotRequired[dict[str, object]]
    executor: NotRequired[ServiceOptions]
