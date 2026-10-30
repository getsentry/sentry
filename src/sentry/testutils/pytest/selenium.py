# TODO(dcramer): this heavily inspired by pytest-selenium, and it's possible
# we could simply inherit from the plugin at this point
import logging
import os
import sys
import threading
from collections.abc import Callable, MutableSequence
from contextlib import contextmanager
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import pytest
from selenium import webdriver
from selenium.common.exceptions import (
    NoAlertPresentException,
    NoSuchElementException,
    SessionNotCreatedException,
    WebDriverException,
)
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.wait import WebDriverWait

from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger("sentry.testutils")


# Selenium's default of 0.5s adds up to half a second to every wait that
# isn't already satisfied, and acceptance tests wait many times each.
WAIT_POLL_SECONDS = 0.1


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

    def element_exists(self, selector=None, xpath=None):
        """
        Check if an element exists on the page. This method will *not* wait for the element.
        """
        try:
            if xpath is not None:
                self.driver.find_element(by=By.XPATH, value=xpath)
            else:
                self.driver.find_element(by=By.CSS_SELECTOR, value=selector)
        except NoSuchElementException:
            return False
        return True

    def element_exists_by_test_id(self, test_id):
        """
        Check if an element exists on the page using a data-test-id attribute.
        This method will not wait for the element.
        """
        return self.element_exists('[data-test-id="%s"]' % (test_id))

    def element_exists_by_aria_label(self, label):
        """
        Check if an element exists on the page using the aria-label attribute.
        This method will not wait for the element.
        """
        return self.element_exists('[aria-label="%s"]' % (label))

    def click(self, selector=None, xpath=None):
        self.element(selector, xpath=xpath).click()

    def click_when_visible(self, selector=None, xpath=None, timeout=3):
        """
        Waits until ``selector`` is available to be clicked before attempting to click
        """
        if selector or xpath:
            self.wait_until_clickable(selector, xpath, timeout)
            self.click(selector, xpath)
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

    def wait_until_clickable(self, selector=None, xpath=None, timeout=10):
        """
        Waits until ``selector`` is visible and enabled to be clicked, or until ``timeout``
        is hit, whichever happens first.
        """
        wait = WebDriverWait(self.driver, timeout, poll_frequency=WAIT_POLL_SECONDS)
        if selector:
            wait.until(expected_conditions.element_to_be_clickable((By.CSS_SELECTOR, selector)))
        elif xpath:
            wait.until(expected_conditions.element_to_be_clickable((By.XPATH, xpath)))
        else:
            raise ValueError

        return self

    def wait_until(self, selector=None, xpath=None, title=None, timeout=10):
        """
        Waits until ``selector`` is found in the browser, or until ``timeout``
        is hit, whichever happens first.
        """
        wait = WebDriverWait(self.driver, timeout, poll_frequency=WAIT_POLL_SECONDS)
        if selector:
            wait.until(expected_conditions.presence_of_element_located((By.CSS_SELECTOR, selector)))
        elif xpath:
            wait.until(expected_conditions.presence_of_element_located((By.XPATH, xpath)))
        elif title:
            wait.until(expected_conditions.title_is(title))
        else:
            raise ValueError

        return self

    def wait_until_test_id(self, test_id):
        return self.wait_until('[data-test-id="%s"]' % (test_id))

    def wait_until_not(self, selector=None, xpath=None, title=None, timeout=10):
        """
        Waits until ``selector`` is NOT found in the browser, or until
        ``timeout`` is hit, whichever happens first.
        """
        wait = WebDriverWait(self.driver, timeout, poll_frequency=WAIT_POLL_SECONDS)
        if selector:
            wait.until_not(
                expected_conditions.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
        elif xpath:
            wait.until_not(expected_conditions.presence_of_element_located((By.XPATH, xpath)))
        elif title:
            wait.until_not(expected_conditions.title_is(title))
        else:
            raise ValueError

        return self

    def wait_until_script_execution(self, script, timeout=10):
        """
        Waits until ``script`` executes and evaluates truthy,
        or until ``timeout`` is hit, whichever happens first.
        """
        wait = WebDriverWait(self.driver, timeout, poll_frequency=WAIT_POLL_SECONDS)
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

        # Initialize the cookie origin without loading the login app, whose
        # async auth requests can overwrite the session installed by login_as.
        if not self._has_initialized_cookie_store:
            logger.info("selenium.initialize-cookies")
            self.get("/robots.txt")

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
        default="chrome",
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


def _launch_chrome(config: pytest.Config) -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    options.add_argument("no-sandbox")
    options.add_argument("disable-gpu")
    options.add_argument("disable-dev-shm-usage")
    options.add_argument(f"window-size={config.getoption('window_size')}")
    if not config.getoption("no_headless"):
        options.add_argument("headless")
    chrome_path = config.getoption("chrome_path")
    if chrome_path:
        options.binary_location = chrome_path
    chrome_args: dict[str, Any] = {"options": options}
    # Without a driver path, Selenium runs Selenium Manager on every launch to
    # look one up, which takes a couple of seconds the first time.
    chromedriver_path = config.getoption("chromedriver_path")
    if chromedriver_path:
        chrome_args["service"] = ChromeService(executable_path=chromedriver_path)

    driver = start_chrome(**chrome_args)
    if config.getoption("slow_network"):
        driver.set_network_conditions(
            offline=False,
            latency=400 * 2,  # additional latency (ms)
            throughput=500 * 1024,  # maximal throughput
        )
    return driver


class _Background:
    """Runs a function on a thread and hands its result back when joined."""

    def __init__(self, name: str, fn: Callable[[], Any]) -> None:
        self._fn = fn
        self._result: Any = None
        self._error: BaseException | None = None
        self._thread = threading.Thread(target=self._run, name=name, daemon=True)
        self._thread.start()

    def _run(self) -> None:
        try:
            self._result = self._fn()
        except BaseException as e:
            self._error = e

    def join(self) -> Any:
        self._thread.join()
        if self._error is not None:
            raise self._error
        return self._result


def _populate_url_resolver() -> None:
    from django.urls import get_resolver

    # The first request to the live server spends seconds importing every
    # URLconf module; doing it here keeps that off the first test.
    get_resolver()._populate()


# The first Chrome launch on a fresh worker and the URLconf import both take
# seconds, and neither needs the test databases. Starting them once collection
# finishes lets them overlap with the test database setup, which runs next.
_warmup: dict[str, _Background] = {}


@pytest.hookimpl(trylast=True)
def pytest_collection_finish(session: pytest.Session) -> None:
    config = session.config
    if config.option.collectonly or config.getoption("selenium_driver") != "chrome":
        return
    if not any("browser" in getattr(item, "fixturenames", ()) for item in session.items):
        return
    _warmup["chrome"] = _Background("selenium-prelaunch-chrome", lambda: _launch_chrome(config))
    _warmup["urls"] = _Background("selenium-warm-urlconf", _populate_url_resolver)


def _take_prelaunched_chrome() -> webdriver.Chrome | None:
    urls = _warmup.pop("urls", None)
    if urls is not None:
        try:
            urls.join()
        except Exception:
            # The first request will import whatever is missing.
            logger.warning("selenium.warm-urlconf.failed", exc_info=True)

    chrome = _warmup.pop("chrome", None)
    if chrome is None:
        return None
    try:
        return chrome.join()
    except Exception:
        logger.warning("selenium.prelaunch-chrome.failed", exc_info=True)
        return None


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    # A worker whose tests never use the browser still has to close the
    # prelaunched Chrome.
    for driver in (_take_prelaunched_chrome(), _reusable_chrome.pop("driver", None)):
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass


# Starting Chrome for every test costs the launch, and each test then loads the
# app bundle into a cold cache. One Chrome per worker, reset between tests,
# keeps the cache warm.
_reusable_chrome: dict[str, webdriver.Chrome] = {}


def _reset_chrome(driver: webdriver.Chrome, origin: str) -> bool:
    """Clears what a test can leave behind. Returns False if Chrome is unusable."""
    try:
        try:
            driver.switch_to.alert.dismiss()
        except NoAlertPresentException:
            pass
        handles = driver.window_handles
        for handle in handles[1:]:
            driver.switch_to.window(handle)
            driver.close()
        driver.switch_to.window(handles[0])
        driver.get("about:blank")
        driver.execute_cdp_cmd("Network.clearBrowserCookies", {})
        driver.execute_cdp_cmd(
            "Storage.clearDataForOrigin", {"origin": origin, "storageTypes": "all"}
        )
        driver.execute_cdp_cmd("Emulation.setTouchEmulationEnabled", {"enabled": False})
        driver.execute_cdp_cmd("Emulation.clearDeviceMetricsOverride", {})
    except Exception:
        logger.warning("selenium.reset-chrome.failed", exc_info=True)
        return False
    return True


@pytest.fixture(scope="function")
def browser(request, live_server):
    window_size = request.config.getoption("window_size")
    window_width, window_height = map(int, window_size.split("x", 1))

    driver_type = request.config.getoption("selenium_driver")
    driver: WebDriver
    if driver_type == "chrome":
        reused = _reusable_chrome.pop("driver", None)
        driver = reused or _take_prelaunched_chrome() or _launch_chrome(request.config)
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
    with assume_test_silo_mode(SiloMode.CONTROL):
        browser.save_cookie("acceptance_test_cookie", "1", path="/auth/login/")

    if hasattr(request, "cls"):
        request.cls.browser = browser
    request.node.browser = browser

    yield driver

    # dump console log to stdout, will be shown when test fails
    for entry in driver.get_log("browser"):
        sys.stderr.write("[browser console] ")
        sys.stderr.write(repr(entry))
        sys.stderr.write("\n")
    if isinstance(driver, webdriver.Chrome) and _reset_chrome(driver, live_server.url):
        _reusable_chrome["driver"] = driver
        return
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
    # Each phase of every test used to take a screenshot and dump the page
    # source. Only a failure needs them.
    if driver is not None and report.failed:
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
            datetime.fromtimestamp(entry["timestamp"] / 1000.0).strftime(timestamp_format), entry
        ).rstrip()
        for entry in log
    ]
    log = "\n".join(entries)
    log = log.encode("utf-8")
    return log
