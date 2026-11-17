from collections.abc import Iterable
from typing import Any

from .row import PartialRowData, Row
from .row_set import RowSet

class Table:
    def read_row(
        self, row_key: str, filter_: Any = None, retry: Any = None
    ) -> PartialRowData | None: ...
    def read_rows(
        self,
        start_key: str | None = None,
        end_key: str | None = None,
        limit: int | None = None,
        filter_: Any = None,
        end_inclusive: bool = False,
        row_set: RowSet | None = None,
        retry: Any = None,
    ) -> Iterable[PartialRowData]: ...
    def direct_row(self, key: str) -> Row: ...
    def mutate_rows(
        self, rows: Iterable[Row], retry: Any = None, timeout: float | None = None
    ) -> Iterable[Any]: ...
    def exists(self) -> bool: ...
    def create(self, column_families: dict[str, Any] | None = None) -> None: ...
    def delete(self) -> None: ...
