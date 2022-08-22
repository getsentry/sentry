from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Attribute:
    name: str
    type: type = str
    required: bool = True

    def extract(self, value: str | None) -> Any | None:
        return None if value is None else self.type(value)
