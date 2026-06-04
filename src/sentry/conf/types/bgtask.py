from typing import NotRequired, TypedDict


class BgTaskConfig(TypedDict):
    roles: NotRequired[list[str]]
    interval: NotRequired[int]
