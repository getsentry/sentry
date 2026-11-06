from typing import Any

from selenium.webdriver.chrome.options import Options
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement as WebElement

class ChromeOptions(Options): ...

class Chrome(WebDriver):
    def __init__(self, **kwargs: Any) -> None: ...

class Firefox(WebDriver):
    def __init__(self, **kwargs: Any) -> None: ...
