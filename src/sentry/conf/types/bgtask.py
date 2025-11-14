from typing import int, TypedDict


class BgTaskConfig(TypedDict, total=False):
    roles: list[str]
    interval: int
