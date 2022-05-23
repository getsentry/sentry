from typing import Mapping, NamedTuple, Optional


class Key(NamedTuple):
    label: str
    url: Optional[str]
    color: str
    data: Mapping[str, int]
