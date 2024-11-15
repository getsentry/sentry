from typing_extensions import Self

from amqp.channel import Channel

class Connection:
    def __init__(
        self,
        host: str = ...,
        userid: str | None = ...,
        password: str | None = ...,
        virtual_host: str = ...,
        ssl: bool = ...,
    ) -> None: ...
    def __enter__(self) -> Self: ...
    def __exit__(self, *a: object) -> None: ...
    def channel(self) -> Channel: ...
