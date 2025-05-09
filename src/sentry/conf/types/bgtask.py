from typing import TypedDict


class BgTaskConfig(TypedDict, total=False):
    roles: list[str]
    interval: int
