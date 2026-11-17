from datetime import datetime
from typing import Any

class Cell:
    timestamp: datetime
    value: bytes

class PartialRowData:
    row_key: bytes
    cells: dict[str, dict[bytes, list[Cell]]]

class Row:
    def delete(self) -> None: ...
    def set_cell(
        self,
        column_family_id: str,
        column: bytes,
        value: bytes,
        timestamp: datetime | None = None,
    ) -> None: ...
    def commit(self) -> Any: ...
