class Encoding:
    ids: list[int]

class Tokenizer:
    @classmethod
    def from_file(cls, path: str) -> Tokenizer: ...
    def encode(
        self, sequence: str, pair: str | None = None, add_special_tokens: bool = True
    ) -> Encoding: ...
