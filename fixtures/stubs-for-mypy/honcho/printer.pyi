from typing import IO, NamedTuple

class Message(NamedTuple):
    type: object
    data: str | bytes
    time: object
    name: str | None
    colour: object

class Printer:
    output: IO[str]
    time_format: str
    width: int
    colour: bool
    prefix: bool
    _colours_supported: bool
    def __init__(
        self,
        *,
        output: IO[str] = ...,
        width: int = ...,
        colour: bool = ...,
        prefix: bool = ...,
    ) -> None: ...
    def write(self, message: Message) -> None: ...
