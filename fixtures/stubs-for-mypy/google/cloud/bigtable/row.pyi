from datetime import datetime
from typing import Any

from .table import Table

class Cell:
    timestamp: datetime
    value: bytes

class PartialRowData:
    row_key: bytes
    cells: dict[str, dict[bytes, list[Cell]]]

class Row:
    @property
    def table(self) -> Table: ...
    def clear(self) -> None: ...
    def delete(self) -> None: ...
    def set_cell(
        self,
        column_family_id: str,
        column: bytes,
        value: bytes,
        timestamp: datetime | None = None,
    ) -> None: ...
    def commit(self) -> Any: ...
