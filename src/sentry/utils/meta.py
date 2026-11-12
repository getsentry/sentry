from collections.abc import Iterator, Mapping
from typing import Any, Literal, NotRequired, TypedDict, cast

RemarkType = Literal["a", "x", "s", "m", "p", "e"]


class Remark(TypedDict):
    rule_id: str
    type: RemarkType
    # Range start is a byte offset
    range_start: NotRequired[int]
    # Range end is a byte offset
    range_end: NotRequired[int]


class Meta:
    """
    A lazy view to detached validation and normalization meta data. It allows to
    safely traverse the meta tree and create a deep path lazily. Use ``enter``
    to get a view to the meta data inside a specific key.

    The ``Meta`` object is a shallow view onto the top-level meta structure and
    only traverses data when actually accessing attributes. Thus, constructing
    Meta or calling ``enter`` is relatively cheap.

    To modify data for a certain path, use ``create`` and modify the returned
    dict. Alternatively, use the ``merge`` or ``add_error`` convenience methods.
    """

    def __init__(
        self, meta: dict[str, object] | None = None, path: list[str] | None = None
    ) -> None:
        self._meta = {} if meta is None else meta
        self._path = path or []

    def enter(self, *path: object) -> "Meta":
        """
        Enters into sub meta data at the specified path. This always returns a
        new ``Meta`` object, regardless whether the path already exists.
        """
        return Meta(self._meta, path=self._path + [str(p) for p in path])

    @property
    def path(self) -> str:
        """
        Returns the full path of this meta instance, joined with dots (".").
        """
        return ".".join(self._path)

    def raw(self) -> dict[str, object]:
        """
        Returns the raw meta tree at the current path, if it exists; otherwise
        an empty object. This will contain both the meta data of the key ("")
        and sub meta trees.

        It is not safe to mutate the return value since it might be detached
        from the actual meta tree.
        """
        meta = self._meta
        for key in self._path:
            meta = cast(dict[str, object], meta.get(key) or {})
        return meta

    def get(self) -> dict[str, object]:
        """
        Returns meta data of the item at the current path, or an empty dict.

        It is not safe to mutate the return value since it might be detached
        from the actual meta tree.
        """
        return cast(dict[str, object], self.raw().get("") or {})

    def create(self) -> dict[str, object]:
        """
        Creates an empty meta data entry corresponding to the current path. This
        recursively creates the entire parent tree.
        """
        meta = self._meta
        for key in self._path + [""]:
            if key not in meta or meta[key] is None:
                meta[key] = {}
            meta = cast(dict[str, object], meta[key])

        return meta

    def merge(self, other: "Meta") -> dict[str, object] | None:
        """
        Merges meta data of the given other ``Meta`` object into the current
        path.

        If no meta data entry exists for the current path, it is created, along
        with the entire parent tree.
        """
        other_data = other.get()
        if not other_data:
            return None

        meta = self.create()
        err = cast("list[object] | None", meta.get("err"))
        meta.update(other_data)

        other_err = cast("list[object] | None", other_data.get("err"))
        if err and other_err:
            meta["err"] = err + other_err

        return meta

    def iter_errors(self) -> Iterator[list[object]]:
        """
        Iterates over meta errors of the item at the current path, if any.

        Each error is a tuple ``(type, data)``, where:
         - ``type`` is the error constant also used in EventError
         - ``data`` a dictionary of additional error infos
        """
        return (
            ([err, {}] if isinstance(err, str) else err)
            for err in cast(Any, self.get().get("err")) or ()
        )

    def get_event_errors(self) -> list[dict[str, object]]:
        """
        Returns all errors of the item at the current path in EventError schema,
        which can directly be stored to an event's "errors" list.
        """

        errors: list[dict[str, object]] = []
        value = self.get().get("val")

        for error, data in self.iter_errors():
            eventerror: dict[str, object] = dict(cast("Mapping[str, object]", data))
            eventerror["type"] = error

            if self._path:
                eventerror["name"] = ".".join(self._path)

            if value is not None:
                eventerror["value"] = value
                value = None

            errors.append(eventerror)

        return errors

    def add_error(
        self, error: object, value: object = None, data: Mapping[object, object] | None = None
    ) -> None:
        """
        Adds an error to the meta data at the current path. The ``error``
        argument is converted to string. If optional ``data`` is specified, the
        data hash is stored alongside the error.

        If an optional ``value`` is specified, it is attached as original value
        into the meta data. Note that there is only one original value, not one
        per error.

        If no meta data entry exists for the current path, it is created, along
        with the entire parent tree.
        """
        meta = self.create()
        if "err" not in meta or meta["err"] is None:
            meta["err"] = []

        error_entry: object = str(error)
        if isinstance(data, Mapping):
            error_entry = [error_entry, dict(data)]
        cast("list[object]", meta["err"]).append(error_entry)

        if value is not None:
            meta["val"] = value

    def add_remark(self, rem: Remark, value: object = None) -> None:
        """
        Adds a remark to the meta data at the current path.

        If an optional ``value`` is specified, it is attached as original value
        into the meta data. Note that there is only one original value, not one
        per remark.

        `range_start` and `range_end` in `rem` are byte offsets.

        If no meta data entry exists for the current path, it is created, along
        with the entire parent tree.
        """
        meta = self.create()
        if "rem" not in meta or meta["rem"] is None:
            meta["rem"] = []

        rem_list: list[str | int] = [rem["rule_id"], rem["type"]]

        range_start = rem.get("range_start")
        if range_start is not None:
            rem_list.append(range_start)

        range_end = rem.get("range_end")
        if range_end is not None:
            rem_list.append(range_end)

        cast("list[object]", meta["rem"]).append(rem_list)

        if value is not None:
            meta["val"] = value

    def __iter__(self) -> Iterator["Meta"]:
        """
        Iterates all child meta entries that potentially have errors set.
        """
        for key in self.raw():
            if key != "":
                yield self.enter(key)
