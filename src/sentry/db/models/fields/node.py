from __future__ import annotations

import logging
from collections.abc import Callable, Iterator, Mapping, MutableMapping
from copy import copy as shallow_copy
from typing import Any, cast

from django.utils.functional import cached_property

from sentry import nodestore

__all__ = ("NodeData",)

logger = logging.getLogger("sentry")


class NodeIntegrityFailure(Exception):
    pass


class NodeData(MutableMapping[str, Any]):
    """
    A wrapper for nodestore data that fetches the underlying data
    from nodestore.

    Initializing with:
    data=None means, this is a node that needs to be fetched from nodestore.
    data={...} means, this is an object that should be saved to nodestore.
    """

    def __init__(
        self,
        id: str,
        data: Mapping[str, Any] | None = None,
        wrapper: Callable[[Mapping[str, Any]], MutableMapping[str, Any]] | None = None,
        ref_version: int | None = None,
        ref_func: Callable[[Any], object] | None = None,
    ) -> None:
        self.id = id
        self.ref = None
        # ref version is used to discredit a previous ref
        # (this does not mean the Event is mutable, it just removes ref checking
        #  in the case of something changing on the data model)
        self.ref_version = ref_version
        self.ref_func = ref_func
        self.wrapper = wrapper
        if data is not None and self.wrapper is not None:
            data = self.wrapper(data)
        self._node_data: MutableMapping[str, Any] | None = (
            cast("MutableMapping[str, Any]", data) if data is not None else None
        )

    def __getstate__(self) -> dict[str, object]:
        data = dict(self.__dict__)
        data.pop("data", None)
        # downgrade this into a normal dict in case it's a shim dict.
        data["_node_data"] = dict(data["_node_data"].items())
        return data

    def __setstate__(self, state: dict[str, object]) -> None:
        self.__dict__ = state

    def __getitem__(self, key: str) -> Any:
        return self.data[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.data[key] = value

    def __delitem__(self, key: str) -> None:
        del self.data[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self.data)

    def __len__(self) -> int:
        return len(self.data)

    def __repr__(self) -> str:
        cls_name = type(self).__name__
        if self._node_data:
            return f"<{cls_name}: id={self.id} data={self._node_data!r}>"
        return f"<{cls_name}: id={self.id}>"

    def get_ref(self, instance: Any) -> object | None:
        if not self.ref_func:
            return None
        return self.ref_func(instance)

    def copy(self) -> MutableMapping[str, Any]:
        return shallow_copy(self.data)

    @cached_property
    def data(self) -> MutableMapping[str, Any]:
        """
        Get the current data object, fetching from nodestore if necessary.
        """

        if self._node_data is not None:
            return self._node_data

        elif self.id:
            self.bind_data(nodestore.backend.get(self.id) or {})
            return cast("MutableMapping[str, Any]", self._node_data)

        rv: MutableMapping[str, Any] = {}
        if self.wrapper is not None:
            rv = self.wrapper(rv)
        return rv

    def bind_data(self, data: MutableMapping[str, Any], ref: object | None = None) -> None:
        self.ref = data.pop("_ref", ref)
        ref_version = data.pop("_ref_version", None)
        if ref_version == self.ref_version and ref is not None and self.ref != ref:
            raise NodeIntegrityFailure(
                f"Node reference for {self.id} is invalid: {ref} != {self.ref}"
            )
        if self.wrapper is not None:
            data = self.wrapper(data)
        self._node_data = data

    def bind_ref(self, instance: Any) -> None:
        ref = self.get_ref(instance)
        if ref:
            self.data["_ref"] = ref
            self.data["_ref_version"] = self.ref_version

    def save(self, subkeys: dict[str | None, Mapping[str, Any]] | None = None) -> None:
        """
        Write current data back to nodestore.

        :param subkeys: Additional JSON payloads to attach to nodestore value,
            currently only {"unprocessed": {...}} is added for reprocessing.
            See documentation of nodestore.
        """

        # We never loaded any data for reading or writing, so there
        # is nothing to save.
        if self._node_data is None:
            return None

        # We can't put our wrappers into the nodestore, so we need to
        # ensure that the data is converted into a plain old dict
        to_write = self._node_data
        if not isinstance(to_write, dict):
            to_write = dict(to_write.items())

        subkeys = subkeys or {}
        subkeys[None] = to_write

        nodestore.backend.set_subkeys(self.id, subkeys)
