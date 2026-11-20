from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement

from sentry.testutils.pytest.selenium import Browser


class BasePage:
    """Base class for PageObjects"""

    def __init__(self, browser: Browser) -> None:
        self.browser = browser

    @property
    def driver(self) -> WebDriver:
        return self.browser.driver

    def wait_until_loaded(self) -> None:
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')


class BaseElement:
    def __init__(self, element: WebElement) -> None:
        self.element = element


class ButtonElement(BaseElement):
    label_attr = "aria-label"
    disabled_attr = "aria-disabled"

    @property
    def disabled(self) -> str | None:
        return self.element.get_attribute(self.disabled_attr)

    @property
    def label(self) -> str | None:
        return self.element.get_attribute(self.label_attr)

    def click(self) -> None:
        self.element.click()


class ButtonWithIconElement(ButtonElement):
    @property
    def icon_href(self) -> str | None:
        return self.element.find_element(by=By.TAG_NAME, value="use").get_attribute("href")


class TextBoxElement(BaseElement):
    pass


class ModalElement(BaseElement):
    pass
