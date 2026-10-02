from collections.abc import Mapping
from typing import Any, SupportsIndex, overload


class SafeText(str):
    """A non-empty display string read from untrusted JSON.

    Indexing with a string key returns `MISSING` instead of raising, so a lookup chain like
    `payload["data"]["method"]` stays safe when `data` turned out to be a string such as
    `"[Filtered]"`. Positional indexing and slicing behave like a normal `str`.
    """

    @overload
    def __getitem__(self, key: str) -> "SafeText": ...

    @overload
    def __getitem__(self, key: SupportsIndex | slice) -> str: ...

    def __getitem__(self, key: str | SupportsIndex | slice) -> str:
        if isinstance(key, str):
            return MISSING
        return super().__getitem__(key)

    def get(self, key: str, default: Any = None) -> Any:
        return default


MISSING = SafeText("")


class SafeDict(dict[str, Any]):
    """Read-only view over untrusted JSON where `[]` never raises.

    Useful for payloads such as replay recordings, which come from many SDK versions and
    platforms, so any key may be missing, null, or a different type than expected.

    `[]` returns a nested `SafeDict` for objects, a `SafeText` for displayable strings and
    numbers, and `MISSING` (an empty, falsy `SafeText`) for anything else, including empty
    objects. Every lookup is safe to chain and drop straight into an f-string, and
    `value or "fallback"` handles the gaps.

    `.get()` keeps normal dict semantics and returns the raw value, for the few fields that
    aren't text (e.g. booleans).

    `[]` deliberately changes dict semantics, so pass the original data, not this view, to
    helpers that expect a plain dict.
    """

    def __getitem__(self, key: str) -> "SafeDict | SafeText":
        return safe_view(super().get(key))


def safe_view(value: Any) -> SafeDict | SafeText:
    """Wrap a decoded JSON value so it can be read with `SafeDict` semantics."""
    if isinstance(value, (SafeDict, SafeText)):
        return value
    if isinstance(value, Mapping):
        return SafeDict(value) if value else MISSING
    if isinstance(value, str):
        return SafeText(value) if value.strip() else MISSING
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return SafeText(value)
    return MISSING
