from typing import Any

class Encoding:
    ids: list[int]

class Tokenizer:
    @classmethod
    def from_file(cls, path: str) -> Tokenizer: ...
    def encode(self, *args: Any, **kwargs: Any) -> Encoding: ...
