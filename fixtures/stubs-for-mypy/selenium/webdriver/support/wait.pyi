from collections.abc import Callable, Sequence
from typing import Literal, TypeVar

from selenium.webdriver.remote.webdriver import WebDriver

T = TypeVar("T")

class WebDriverWait:
    def __init__(
        self,
        driver: WebDriver,
        timeout: float,
        poll_frequency: float = 0.5,
        ignored_exceptions: Sequence[type[Exception]] | None = None,
    ) -> None: ...
    def until(self, method: Callable[[WebDriver], Literal[False] | T], message: str = "") -> T: ...
    def until_not(self, method: Callable[[WebDriver], T], message: str = "") -> T: ...
