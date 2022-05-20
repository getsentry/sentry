from __future__ import annotations

from typing import Any as Any_


def Any(cls: Any_ | None = None):
    if not cls:
        return True

    class Any:
        def __eq__(self, other):
            return isinstance(other, cls)

    return Any()
