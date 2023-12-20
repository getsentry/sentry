# TODO(dcramer): this heavily inspired by pytest-selenium, and it's possible
# we could simply inherit from the plugin at this point
import logging
import os
import sys
from contextlib import contextmanager
from datetime import datetime
from typing import MutableSequence
from urllib.parse import urlparse

import pytest
from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    SessionNotCreatedException,
    WebDriverException,
)
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.wait import WebDriverWait

from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger("sentry.testutils")


class Browser:
    def __init__(self, driver, live_server):
        self.driver = driver
        self.live_server_url = live_server.url
        self.domain = urlparse(self.live_server_url).hostname
        self._has_initialized_cookie_store = False

    def __getattr__(self, attr):
        return getattr(self.driver, attr)

    def route(self, path, *args, **kwargs):
        """
        Return the absolute URI for a given route in Sentry.
        """
        return "{}/{}".format(self.live_server_url, path.lstrip("/").format(*args, **kwargs))

    def get(self, path, *args, **kwargs):
        self.driver.get(self.route(path), *args, **kwargs)
        self._has_initialized_cookie_store = True
        return self

    def post(self, path, *args, **kwargs):
        self.driver.post(self.route(path), *args, **kwargs)
        self._has_initialized_cookie_store = True
        return self

    def put(self, path, *args, **kwargs):
        self.driver.put(self.route(path), *args, **kwargs)
        self._has_initialized_cookie_store = True
        return self

    def delete(self, path, *args, **kwargs):
        self.driver.delete(self.route(path), *args, **kwargs)
        self._has_initialized_cookie_store = True
        return self

    def set_emulated_media(self, features, media=""):
        """
        This is used to emulate different media features (e.g. color scheme)
        """
        return self.driver.execute_cdp_cmd(
            "Emulation.setEmulatedMedia", {"media": media, "features": features}
        )

    def get_content_height(self):
        """
        Get height of current DOM contents

        Adapted from https://stackoverflow.com/questions/41721734/take-screenshot-of-full-page-with-selenium-python-with-chromedriver/52572919#52572919
        """

        return self.driver.execute_script("return document.body.parentNode.scrollHeight")

    def set_window_size(self, width=None, height=None, fit_content=False):
        """
        Sets the window size.

        If width is not passed, then use current window width (this is useful if you
        need to fit contents height into the viewport).
        If height is not passed, then resize to fit the document contents.
        """

        previous_size = self.driver.get_window_size()
        width = width if width is not None else previous_size["width"]

        if fit_content:
            # In order to set window height to content height, we must make sure
            # width has not changed (otherwise contents will shift,
            # and we require two resizes)
            self.driver.set_window_size(width, previous_size["height"])
            height = self.get_content_height()
        else:
            height = height if height is not None else self.get_content_height()

        self.driver.set_window_size(width, height)

        return {
            "previous": previous_size,
            "current": {"width": width, "height": height},
        }

    def set_viewport(self, width, height, fit_content):
        size = self.set_window_size(width, height, fit_content)
        try:
            yield size
        finally:
            # restore previous size
            self.set_window_size(size["previous"]["width"], size["previous"]["height"])

    @contextmanager
    def full_viewport(self, width=None, height=None, fit_content=True):
        return self.set_viewport(width, height, fit_content)

    @contextmanager
    def mobile_viewport(self, width=375, height=812):
        return self.set_viewport(width, height, fit_content=True)

    def element(self, selector=None, xpath=None):
        """
        Get an element from the page. This method will wait for the element to show up.
        """

        if xpath is not None:
            self.wait_until(xpath=xpath)
            return self.driver.find_element(by=By.XPATH, value=xpath)
        else:
            self.wait_until(selector)
            return self.driver.find_element(by=By.CSS_SELECTOR, value=selector)

    def elements(self, selector=None, xpath=None):
        """
        Get elements from the page. This method will wait for the element to show up.
        """

        if xpath is not None:
            self.wait_until(xpath=xpath)
            return self.driver.find_elements(by=By.XPATH, value=xpath)
        else:
            self.wait_until(selector)
            return self.driver.find_elements(by=By.CSS_SELECTOR, value=selector)

    def element_exists(self, selector):
        """
        Check if an element exists on the page. This method will *not* wait for the element.
        """
        try:
            self.driver.find_element(by=By.CSS_SELECTOR, value=selector)
        except NoSuchElementException:
            return False
        return True

    def element_exists_by_test_id(self, selector):
        """
        Check if an element exists on the page using a data-test-id attribute.
        This method will not wait for the element.
        """
        return self.element_exists('[data-test-id="%s"]' % (selector))

    def element_exists_by_aria_label(self, selector):
        """
        Check if an element exists on the page using the aria-label attribute.
        This method will not wait for the element.
        """
        return self.element_exists('[aria-label="%s"]' % (selector))

    def click(self, selector=None, xpath=None):
        self.element(selector, xpath=xpath).click()

    def click_when_visible(self, selector=None, timeout=3):
        """
        Waits until ``selector`` is available to be clicked before attempting to click
        """
        if selector:
            self.wait_until_clickable(selector, timeout)
            self.click(selector)
        else:
            raise ValueError

        return self

    def find_element_by_name(self, name):
        return self.driver.find_element(by=By.NAME, value=name)

    def move_to(self, selector=None):
        """
        Mouse move to ``selector``
        """
        if selector:
            actions = ActionChains(self.driver)
            actions.move_to_element(self.element(selector)).perform()
        else:
            raise ValueError

        return self

    def wait_until_clickable(self, selector=None, timeout=10):
        """
        Waits until ``selector`` is visible and enabled to be clicked, or until ``timeout``
        is hit, whichever happens first.
        """
        wait = WebDriverWait(self.driver, timeout)
        if selector:
            wait.until(expected_conditions.element_to_be_clickable((By.CSS_SELECTOR, selector)))
        else:
            raise ValueError

        return self

    def wait_until(self, selector=None, xpath=None, title=None, timeout=10):
        """
        Waits until ``selector`` is found in the browser, or until ``timeout``
        is hit, whichever happens first.
        """
        wait = WebDriverWait(self.driver, timeout)
        if selector:
            wait.until(expected_conditions.presence_of_element_located((By.CSS_SELECTOR, selector)))
        elif xpath:
            wait.until(expected_conditions.presence_of_element_located((By.XPATH, xpath)))
        elif title:
            wait.until(expected_conditions.title_is(title))
        else:
            raise ValueError

        return self

    def wait_until_test_id(self, selector):
        return self.wait_until('[data-test-id="%s"]' % (selector))

    def wait_until_not(self, selector=None, title=None, timeout=10):
        """
        Waits until ``selector`` is NOT found in the browser, or until
        ``timeout`` is hit, whichever happens first.
        """
        wait = WebDriverWait(self.driver, timeout)
        if selector:
            wait.until_not(
                expected_conditions.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
        elif title:
            wait.until_not(expected_conditions.title_is(title))
        else:
            raise

        return self

    def wait_until_script_execution(self, script, timeout=10):
        """
        Waits until ``script`` executes and evaluates truthy,
        or until ``timeout`` is hit, whichever happens first.
        """
        wait = WebDriverWait(self.driver, timeout)
        wait.until(lambda driver: driver.execute_script(script))

        return self

    def wait_for_images_loaded(self, timeout=10):
        return self.wait_until_script_execution(
            """return Object.values(document.querySelectorAll('img')).map(el => el.complete).every(i => i)""",
            timeout,
        )

    def wait_for_fonts_loaded(self, timeout=10):
        return self.wait_until_script_execution(
            """return document.fonts.status === 'loaded'""",
            timeout,
        )

    @property
    def switch_to(self):
        return self.driver.switch_to

    def implicitly_wait(self, duration):
        """
        An implicit wait tells WebDriver to poll the DOM for a certain amount of
        time when trying to find any element (or elements) not immediately
        available. The default setting is 0. Once set, the implicit wait is set
        for the life of the WebDriver object.
        """
        self.driver.implicitly_wait(duration)

    def get_local_storage_items(self):
        """
        Retrieve all items in local storage
        """

        return self.driver.execute_script(
            "Object.fromEntries(Object.entries(window.localStorage));"
        )

    def get_local_storage_item(self, key):
        """
        Retrieve key from local storage, this will fail if you use single quotes in your keys.
        """

        return self.driver.execute_script(f"window.localStorage.getItem('{key}')")

    def save_cookie(
        self,
        name,
        value,
        domain=None,
        path="/",
        expires="Tue, 20 Jun 2025 19:07:44 GMT",
        max_age=None,
        secure=None,
    ):
        domain = domain or self.domain
        # Recent changes to Chrome no longer allow us to explicitly set a cookie domain
        # to be localhost. If no domain is specified, the cookie will be created on
        # the host of the current url that the browser has visited.
        if domain == "localhost":
            domain = None
        cookie = {
            "name": name,
            "value": value,
            "expires": expires,
            "path": path,
            "max-age": max_age,
            "secure": secure,
        }
        if domain:
            cookie["domain"] = domain

        # XXX(dcramer): the cookie store must be initialized via a URL
        if not self._has_initialized_cookie_store:
            logger.info("selenium.initialize-cookies")
            self.get("/")

        # TODO(dcramer): this should be escaped, but idgaf
        logger.info("selenium.set-cookie.%s", name, extra={"value": value})
        # XXX(dcramer): chromedriver (of certain versions) is complaining about this being
        # an invalid kwarg
        del cookie["secure"]
        self.driver.add_cookie(cookie)


def pytest_addoption(parser):
    parser.addini("selenium_driver", help="selenium driver (chrome, or firefox)")

    group = parser.getgroup("selenium", "selenium")
    group._addoption(
        "--selenium-driver",
        dest="selenium_driver",
        help="selenium driver (chrome, or firefox)",
    )
    group._addoption(
        "--window-size", dest="window_size", help="window size (WIDTHxHEIGHT)", default="1680x1050"
    )
    group._addoption("--chrome-path", dest="chrome_path", help="path to google-chrome")
    group._addoption("--chromedriver-path", dest="chromedriver_path", help="path to chromedriver")
    group._addoption(
        "--no-headless", dest="no_headless", help="show a browser while running the tests (chrome)"
    )
    group._addoption("--slow-network", dest="slow_network", help="slow the network (chrome)")


def pytest_configure(config):
    if hasattr(config, "workerinput"):
        return  # xdist worker

    config.option.selenium_driver = (
        config.getoption("selenium_driver")
        or config.getini("selenium_driver")
        or os.getenv("SELENIUM_DRIVER")
    )


@TimedRetryPolicy.wrap(timeout=15, exceptions=(WebDriverException,), log_original_error=True)
def start_chrome(**chrome_args):
    try:
        return webdriver.Chrome(**chrome_args)
    except SessionNotCreatedException as e:
        if "This version of ChromeDriver only supports Chrome version" in (e.msg or ""):
            raise Exception(
                """ChromeDriver version does not match Chrome version, update ChromeDriver (e.g. if you use `homebrew`):

    brew upgrade --cask chromedriver
    """
            )


@pytest.fixture(scope="function")
def browser(request, live_server):
    window_size = request.config.getoption("window_size")
    window_width, window_height = map(int, window_size.split("x", 1))

    driver_type = request.config.getoption("selenium_driver")
    headless = not request.config.getoption("no_headless")
    slow_network = request.config.getoption("slow_network")
    if driver_type == "chrome":
        options = webdriver.ChromeOptions()
        options.add_argument("no-sandbox")
        options.add_argument("disable-gpu")
        options.add_argument("disable-dev-shm-usage")
        options.add_argument(f"window-size={window_size}")
        if headless:
            options.add_argument("headless")
        chrome_path = request.config.getoption("chrome_path")
        if chrome_path:
            options.binary_location = chrome_path
        chromedriver_path = request.config.getoption("chromedriver_path")
        chrome_args = {"options": options}
        if chromedriver_path:
            chrome_args["executable_path"] = chromedriver_path

        driver = start_chrome(**chrome_args)
        if slow_network:
            driver.set_network_conditions(
                offline=False,
                latency=400 * 2,  # additional latency (ms)
                throughput=500 * 1024,  # maximal throughput
            )
    elif driver_type == "firefox":
        driver = webdriver.Firefox()
    else:
        raise pytest.UsageError("--driver must be specified")

    driver.set_window_size(window_width, window_height)

    request.node._driver = driver

    browser = Browser(driver, live_server)

    browser.set_emulated_media([{"name": "prefers-reduced-motion", "value": "reduce"}])

    # XXX: We explicitly set an extra garbage cookie, just so like in
    # production, there are more than one cookies set.
    #
    # This is the outcome of an incident where the acceptance tests failed to
    # capture an issue where cookie lookup in the frontend failed, but did NOT
    # fail in the acceptance tests because the code worked fine when
    # document.cookie only had one cookie in it.
    browser.save_cookie("acceptance_test_cookie", "1")

    if hasattr(request, "cls"):
        request.cls.browser = browser
    request.node.browser = browser

    yield driver

    # dump console log to stdout, will be shown when test fails
    for entry in driver.get_log("browser"):
        sys.stderr.write("[browser console] ")
        sys.stderr.write(repr(entry))
        sys.stderr.write("\n")
    # Teardown Selenium.
    try:
        driver.quit()
    except Exception:
        pass


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    summary: MutableSequence[str] = []
    extra = getattr(report, "extra", [])
    driver = getattr(item, "_driver", None)
    if driver is not None:
        _gather_url(item, report, driver, summary, extra)
        _gather_screenshot(item, report, driver, summary, extra)
        _gather_html(item, report, driver, summary, extra)
        _gather_logs(item, report, driver, summary, extra)
    if summary:
        report.sections.append(("selenium", "\n".join(summary)))
    report.extra = extra


def _gather_url(item, report, driver, summary, extra):
    try:
        url = driver.current_url
    except Exception as e:
        summary.append(f"WARNING: Failed to gather URL: {e}")
        return
    pytest_html = item.config.pluginmanager.getplugin("html")
    if pytest_html is not None:
        # add url to the html report
        extra.append(pytest_html.extras.url(url))
    summary.append(f"URL: {url}")


def _gather_screenshot(item, report, driver, summary, extra):
    try:
        screenshot = driver.get_screenshot_as_base64()
    except Exception as e:
        summary.append(f"WARNING: Failed to gather screenshot: {e}")
        return
    pytest_html = item.config.pluginmanager.getplugin("html")
    if pytest_html is not None:
        # add screenshot to the html report
        extra.append(pytest_html.extras.image(screenshot, "Screenshot"))


def _gather_html(item, report, driver, summary, extra):
    try:
        html = driver.page_source.encode("utf-8")
    except Exception as e:
        summary.append(f"WARNING: Failed to gather HTML: {e}")
        return
    pytest_html = item.config.pluginmanager.getplugin("html")
    if pytest_html is not None:
        # add page source to the html report
        extra.append(pytest_html.extras.text(html, "HTML"))


def _gather_logs(item, report, driver, summary, extra):
    try:
        types = driver.log_types
    except Exception as e:
        # note that some drivers may not implement log types
        summary.append(f"WARNING: Failed to gather log types: {e}")
        return
    for name in types:
        try:
            log = driver.get_log(name)
        except Exception as e:
            summary.append(f"WARNING: Failed to gather {name} log: {e}")
            return
        pytest_html = item.config.pluginmanager.getplugin("html")
        if pytest_html is not None:
            extra.append(pytest_html.extras.text(format_log(log), "%s Log" % name.title()))


def format_log(log):
    timestamp_format = "%Y-%m-%d %H:%M:%S.%f"
    entries = [
        "{0} {1[level]} - {1[message]}".format(
            datetime.utcfromtimestamp(entry["timestamp"] / 1000.0).strftime(timestamp_format), entry
        ).rstrip()
        for entry in log
    ]
    log = "\n".join(entries)
    log = log.encode("utf-8")
    return log
