from __future__ import absolute_import

# TODO(dcramer): this heavily inspired by pytest-selenium, and it's possible
# we could simply inherit from the plugin at this point

import logging
import os
import sys
import pytest

from datetime import datetime
from django.conf import settings
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, WebDriverException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.common.action_chains import ActionChains
from six.moves.urllib.parse import quote, urlparse

from sentry.utils.retries import TimedRetryPolicy

# if we're not running in a PR, we kill the PERCY_TOKEN because its a push
# to a branch, and we dont want percy comparing things
# we do need to ensure its run on master so that changes get updated
if (
    os.environ.get("TRAVIS_PULL_REQUEST", "false") == "false"
    and os.environ.get("TRAVIS_BRANCH", "master") != "master"
):
    os.environ.setdefault("PERCY_ENABLE", "0")

logger = logging.getLogger("sentry.testutils")


class Browser(object):
    def __init__(self, driver, live_server, percy):
        self.driver = driver
        self.live_server_url = live_server.url
        self.percy = percy
        self.domain = urlparse(self.live_server_url).hostname
        self._has_initialized_cookie_store = False

    def __getattr__(self, attr):
        return getattr(self.driver, attr)

    def route(self, path, *args, **kwargs):
        """
        Return the absolute URI for a given route in Sentry.
        """
        return u"{}/{}".format(self.live_server_url, path.lstrip("/").format(*args, **kwargs))

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

    def element(self, selector):
        """
        Get an element from the page. This method will wait for the element to show up.
        """
        self.wait_until(selector)
        return self.driver.find_element_by_css_selector(selector)

    def element_exists(self, selector):
        """
        Check if an element exists on the page. This method will *not* wait for the element.
        """
        try:
            self.driver.find_element_by_css_selector(selector)
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

    def click(self, selector):
        self.element(selector).click()

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
        from selenium.webdriver.common.by import By

        if selector:
            condition = expected_conditions.element_to_be_clickable((By.CSS_SELECTOR, selector))
        else:
            raise ValueError

        WebDriverWait(self.driver, timeout).until(condition)

        return self

    def wait_until(self, selector=None, xpath=None, title=None, timeout=10):
        """
        Waits until ``selector`` is found in the browser, or until ``timeout``
        is hit, whichever happens first.
        """
        from selenium.webdriver.common.by import By

        if selector:
            condition = expected_conditions.presence_of_element_located((By.CSS_SELECTOR, selector))
        elif xpath:
            condition = expected_conditions.presence_of_element_located((By.XPATH, xpath))
        elif title:
            condition = expected_conditions.title_is(title)
        else:
            raise ValueError

        WebDriverWait(self.driver, timeout).until(condition)

        return self

    def wait_until_test_id(self, selector):
        return self.wait_until('[data-test-id="%s"]' % (selector))

    def wait_until_not(self, selector=None, title=None, timeout=10):
        """
        Waits until ``selector`` is NOT found in the browser, or until
        ``timeout`` is hit, whichever happens first.
        """
        from selenium.webdriver.common.by import By

        if selector:
            condition = expected_conditions.presence_of_element_located((By.CSS_SELECTOR, selector))
        elif title:
            condition = expected_conditions.title_is(title)
        else:
            raise

        WebDriverWait(self.driver, timeout).until_not(condition)

        return self

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

    def snapshot(self, name):
        """
        Capture a screenshot of the current state of the page.
        """
        # TODO(dcramer): ideally this would take the executing test package
        # into account for duplicate names
        if os.environ.get("SENTRY_SCREENSHOT") == "open":
            import tempfile
            import click
            import time

            with tempfile.NamedTemporaryFile("wb", suffix=".png") as tf:
                tf.write(self.driver.get_screenshot_as_png())
                tf.flush()
                click.launch(tf.name)
                time.sleep(1)

        self.percy.snapshot(name=name)
        return self

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

        # XXX(dcramer): PhantomJS does not let us add cookies with the native
        # selenium API because....
        # http://stackoverflow.com/questions/37103621/adding-cookies-working-with-firefox-webdriver-but-not-in-phantomjs

        # TODO(dcramer): this should be escaped, but idgaf
        logger.info(u"selenium.set-cookie.{}".format(name), extra={"value": value})
        if isinstance(self.driver, webdriver.PhantomJS):
            self.driver.execute_script(
                u"document.cookie = '{name}={value}; path={path}; domain={domain}; expires={expires}'; max-age={max_age}\n".format(
                    **cookie
                )
            )
        else:
            # XXX(dcramer): chromedriver (of certain versions) is complaining about this being
            # an invalid kwarg
            del cookie["secure"]
            self.driver.add_cookie(cookie)


def pytest_addoption(parser):
    parser.addini("selenium_driver", help="selenium driver (chrome, phantomjs, or firefox)")

    group = parser.getgroup("selenium", "selenium")
    group._addoption(
        "--selenium-driver",
        dest="selenium_driver",
        help="selenium driver (chrome, phantomjs, or firefox)",
    )
    group._addoption(
        "--window-size", dest="window_size", help="window size (WIDTHxHEIGHT)", default="1680x1050"
    )
    group._addoption("--phantomjs-path", dest="phantomjs_path", help="path to phantomjs driver")
    group._addoption("--chrome-path", dest="chrome_path", help="path to google-chrome")
    group._addoption("--chromedriver-path", dest="chromedriver_path", help="path to chromedriver")
    group._addoption(
        "--no-headless", dest="no_headless", help="show a browser while running the tests (chrome)"
    )


def pytest_configure(config):
    if hasattr(config, "slaveinput"):
        return  # xdist slave

    config.option.selenium_driver = (
        config.getoption("selenium_driver")
        or config.getini("selenium_driver")
        or os.getenv("SELENIUM_DRIVER")
    )


@pytest.fixture(scope="session")
def percy(request):
    import percy

    # Initialize Percy.
    loader = percy.ResourceLoader(
        root_dir=settings.STATIC_ROOT, base_url=quote(settings.STATIC_URL)
    )
    percy_config = percy.Config(default_widths=settings.PERCY_DEFAULT_TESTING_WIDTHS)
    percy = percy.Runner(loader=loader, config=percy_config)
    percy.initialize_build()

    request.addfinalizer(percy.finalize_build)
    return percy


@TimedRetryPolicy.wrap(timeout=15, exceptions=(WebDriverException,))
def start_chrome(**chrome_args):
    return webdriver.Chrome(**chrome_args)


@pytest.fixture(scope="function")
def browser(request, percy, live_server):
    window_size = request.config.getoption("window_size")
    window_width, window_height = list(map(int, window_size.split("x", 1)))

    driver_type = request.config.getoption("selenium_driver")
    headless = not request.config.getoption("no_headless")
    if driver_type == "chrome":
        options = webdriver.ChromeOptions()
        options.add_argument("no-sandbox")
        options.add_argument("disable-gpu")
        options.add_argument(u"window-size={}".format(window_size))
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
    elif driver_type == "firefox":
        driver = webdriver.Firefox()
    elif driver_type == "phantomjs":
        phantomjs_path = request.config.getoption("phantomjs_path")
        if not phantomjs_path:
            phantomjs_path = os.path.join("node_modules", "phantomjs-prebuilt", "bin", "phantomjs")
        driver = webdriver.PhantomJS(executable_path=phantomjs_path)
    else:
        raise pytest.UsageError("--driver must be specified")

    driver.set_window_size(window_width, window_height)

    def fin():
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

    request.node._driver = driver
    request.addfinalizer(fin)

    browser = Browser(driver, live_server, percy)

    if hasattr(request, "cls"):
        request.cls.browser = browser
    request.node.browser = browser

    # bind webdriver to percy for snapshots
    percy.loader.webdriver = driver

    return driver


@pytest.fixture(scope="session", autouse=True)
def _environment(request):
    config = request.config
    # add environment details to the pytest-html plugin
    config._metadata.update({"Driver": config.option.selenium_driver})


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    summary = []
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
        summary.append(u"WARNING: Failed to gather URL: {0}".format(e))
        return
    pytest_html = item.config.pluginmanager.getplugin("html")
    if pytest_html is not None:
        # add url to the html report
        extra.append(pytest_html.extras.url(url))
    summary.append(u"URL: {0}".format(url))


def _gather_screenshot(item, report, driver, summary, extra):
    try:
        screenshot = driver.get_screenshot_as_base64()
    except Exception as e:
        summary.append(u"WARNING: Failed to gather screenshot: {0}".format(e))
        return
    pytest_html = item.config.pluginmanager.getplugin("html")
    if pytest_html is not None:
        # add screenshot to the html report
        extra.append(pytest_html.extras.image(screenshot, "Screenshot"))


def _gather_html(item, report, driver, summary, extra):
    try:
        html = driver.page_source.encode("utf-8")
    except Exception as e:
        summary.append(u"WARNING: Failed to gather HTML: {0}".format(e))
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
        summary.append(u"WARNING: Failed to gather log types: {0}".format(e))
        return
    for name in types:
        try:
            log = driver.get_log(name)
        except Exception as e:
            summary.append(u"WARNING: Failed to gather {0} log: {1}".format(name, e))
            return
        pytest_html = item.config.pluginmanager.getplugin("html")
        if pytest_html is not None:
            extra.append(pytest_html.extras.text(format_log(log), "%s Log" % name.title()))


def format_log(log):
    timestamp_format = "%Y-%m-%d %H:%M:%S.%f"
    entries = [
        u"{0} {1[level]} - {1[message]}".format(
            datetime.utcfromtimestamp(entry["timestamp"] / 1000.0).strftime(timestamp_format), entry
        ).rstrip()
        for entry in log
    ]
    log = "\n".join(entries)
    log = log.encode("utf-8")
    return log
