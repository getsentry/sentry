from collections.abc import Sequence
from typing import Any

class Cell:
    value: bytes
    row_key: bytes
    family: str
    qualifier: bytes
    timestamp_micros: int
    def __init__(
        self,
        value: bytes,
        row_key: bytes,
        family: str,
        qualifier: bytes | str,
        timestamp_micros: int,
        labels: list[str] | None = None,
    ) -> None: ...

class Row:
    row_key: bytes
    def __init__(self, key: bytes, cells: list[Cell]) -> None: ...
    def get_cells(
        self, family: str | None = None, qualifier: str | bytes | None = None
    ) -> list[Cell]: ...
    def __contains__(self, item: object) -> bool: ...

class ReadRowsQuery:
    row_keys: list[bytes]
    def __init__(
        self,
        row_keys: list[str | bytes] | str | bytes | None = None,
        row_ranges: Any = None,
        limit: int | None = None,
        row_filter: Any = None,
    ) -> None: ...

class Mutation: ...

class SetCell(Mutation):
    family: str
    qualifier: bytes
    new_value: bytes
    timestamp_micros: int
    def __init__(
        self,
        family: str,
        qualifier: bytes | str,
        new_value: bytes | str | int,
        timestamp_micros: int | None = None,
    ) -> None: ...

class DeleteAllFromRow(Mutation): ...

class RowMutationEntry:
    row_key: bytes
    mutations: tuple[Mutation, ...]
    def __init__(self, row_key: bytes | str, mutations: Mutation | list[Mutation]) -> None: ...

class MutationsExceptionGroup(Exception):
    exceptions: Sequence[Exception]
    def __init__(
        self, excs: list[Exception], total_entries: int, message: str | None = None
    ) -> None: ...

class Table:
    def read_row(
        self,
        row_key: str | bytes,
        *,
        row_filter: Any = None,
        operation_timeout: float = ...,
        attempt_timeout: float | None = ...,
    ) -> Row | None: ...
    def read_rows(
        self,
        query: ReadRowsQuery,
        *,
        operation_timeout: float = ...,
        attempt_timeout: float | None = ...,
    ) -> list[Row]: ...
    def mutate_row(
        self,
        row_key: str | bytes,
        mutations: list[Mutation] | Mutation,
        *,
        operation_timeout: float = ...,
        attempt_timeout: float | None = ...,
    ) -> None: ...
    def bulk_mutate_rows(
        self,
        mutation_entries: list[RowMutationEntry],
        *,
        operation_timeout: float = ...,
        attempt_timeout: float | None = ...,
    ) -> None: ...

class BigtableDataClient:
    def __init__(self, *, project: str | None = None, **kwargs: Any) -> None: ...
    def get_table(
        self, instance_id: str, table_id: str, app_profile_id: str | None = None, **kwargs: Any
    ) -> Table: ...
    def close(self, timeout: float | None = 2.0) -> None: ...
