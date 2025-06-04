from __future__ import annotations

from collections.abc import Iterator, Mapping, MutableMapping
from typing import Self, TypeVar

import orjson
from sentry_relay.processing import StoreNormalizer

from sentry.db.models import NodeData

V = TypeVar("V")


class EventDict(MutableMapping[str, V]):
    """
    Creating an instance of this dictionary will send the event through basic
    (Rust-based) type/schema validation called "re-normalization".

    This is used as a wrapper type for `Event.data` such that creating an event
    object (or loading it from the DB) will ensure the data fits the type
    schema.
    """

    def __init__(self, data: Mapping[str, V], skip_renormalization: bool = False) -> None:
        is_renormalized = isinstance(data, EventDict) or (
            isinstance(data, NodeData) and isinstance(data.data, EventDict)
        )

        if not skip_renormalization and not is_renormalized:
            data_mut = dict(data)
            pre_normalize_type = data_mut.get("type")
            normalizer = StoreNormalizer(
                is_renormalize=True, enable_trimming=False, json_dumps=orjson.dumps
            )
            data_mut = normalizer.normalize_event(data_mut, json_loads=orjson.loads)
            # XXX: This is a hack to make generic events work (for now?). I'm not sure whether we
            # should include this in the rust normalizer, since we don't want people sending us
            # these via the sdk.
            if pre_normalize_type == "generic":
                data_mut["type"] = pre_normalize_type

            data = data_mut

        self.data = {**data}

    # implementation of copy

    def copy(self) -> Self:
        return type(self)(self.data, skip_renormalization=True)

    __copy__ = copy

    # implementation of MutableMapping

    def __getitem__(self, k: str) -> V:
        return self.data[k]

    def __setitem__(self, k: str, v: V) -> None:
        self.data[k] = v

    def __delitem__(self, k: str) -> None:
        del self.data[k]

    def __iter__(self) -> Iterator[str]:
        return iter(self.data)

    def __len__(self) -> int:
        return len(self.data)

    # debugging repr

    def __repr__(self) -> str:
        return f"{type(self).__name__}({self.data!r})"
