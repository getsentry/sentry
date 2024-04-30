from typing import Sequence

from .widgets import WidgetBase

class ProgressBar:
    def __init__(
        self,
        widgets: Sequence[str | WidgetBase] = ...,
        max_value: int = ...,
        min_poll_interval: float = ...,
    ) -> None: ...
    def start(self) -> None: ...
    def update(self, value: int) -> None: ...
    def finish(self) -> None: ...
