from __future__ import annotations

from typing import Iterable

import mmh3


class MinHashSignatureBuilder:
    def __init__(self, columns: int, rows: int) -> None:
        self.columns = columns
        self.rows = rows

    def __call__(self, features: Iterable[str]) -> list[int]:
        return [
            min(mmh3.hash(feature, column) % self.rows for feature in features)
            for column in range(self.columns)
        ]
