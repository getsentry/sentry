class Encoding:
    ids: list[int]


class Tokenizer:
    @staticmethod
    def from_file(path: str) -> "Tokenizer": ...

    def encode(self, sequence: str) -> Encoding: ...
