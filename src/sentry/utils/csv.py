from __future__ import annotations

_FORMULA_PREFIXES = ("=", "+", "-", "@")


def escape_csv_value[T](value: T) -> T | str:
    if isinstance(value, str) and value.lstrip().startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value
