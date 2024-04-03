from .printer import Printer
from .process import Process

class Manager:
    returncode: int | None
    def __init__(self, printer: Printer | None = ...) -> None: ...
    def add_process(
        self,
        name: str,
        cmd: str,
        quiet: bool = ...,
        env: dict[str, str] | None = ...,
        cwd: str | None = ...,
    ) -> Process: ...
    def loop(self) -> None: ...
