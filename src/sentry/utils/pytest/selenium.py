from __future__ import absolute_import

# TODO(dcramer): this heavily inspired by pytest-selenium, and it's possible
# we could simply inherit from the plugin at this point

import os
import pytest
import signal

from datetime import datetime
from django.conf import settings
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions
from six.moves.urllib.parse import quote, urlparse


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
        return '{}/{}'.format(self.live_server_url, path.strip('/').format(
            *args, **kwargs
        ))

    def get(self, path, *args, **kwargs):
        self.driver.get(self.route(path), *args, **kwargs)
        return self

    def post(self, path, *args, **kwargs):
        self.driver.post(self.route(path), *args, **kwargs)
        return self

    def put(self, path, *args, **kwargs):
        self.driver.put(self.route(path), *args, **kwargs)
        return self

    def delete(self, path, *args, **kwargs):
        self.driver.delete(self.route(path), *args, **kwargs)
        return self

    def element(self, selector):
        return self.driver.find_element_by_css_selector(selector)

    def element_exists(self, selector):
        try:
            self.element(selector)
        except NoSuchElementException:
            return False
        return True

    def click(self, selector):
        self.element(selector).click()

    def wait_until(self, selector, timeout=3):
        """
        Waits until ``selector`` is found in the browser, or until ``timeout``
        is hit, whichever happens first.
        """
        from selenium.webdriver.common.by import By

        WebDriverWait(self.driver, timeout).until(
            expected_conditions.presence_of_element_located(
                (By.CSS_SELECTOR, selector)
            )
        )

        return self

    def wait_until_not(self, selector, timeout=3):
        """
        Waits until ``selector`` is NOT found in the browser, or until
        ``timeout`` is hit, whichever happens first.
        """
        from selenium.webdriver.common.by import By

        WebDriverWait(self.driver, timeout).until_not(
            expected_conditions.presence_of_element_located(
                (By.CSS_SELECTOR, selector)
            )
        )

        return self

    def snapshot(self, name):
        """
        Capture a screenshot of the current state of the page. Screenshots
        are captured both locally (in ``cls.screenshots_path``) as well as
        with Percy (when enabled).
        """
        # TODO(dcramer): ideally this would take the executing test package
        # into account for duplicate names
        self.percy.snapshot(name=name)
        return self

    def save_cookie(self, name, value, path='/',
                    expires='Tue, 20 Jun 2025 19:07:44 GMT'):
        # XXX(dcramer): "hit a url before trying to set cookies"
        if not self._has_initialized_cookie_store:
            self.get('/')
            self._has_initialized_cookie_store = True

        # XXX(dcramer): PhantomJS does not let us add cookies with the native
        # selenium API because....
        # http://stackoverflow.com/questions/37103621/adding-cookies-working-with-firefox-webdriver-but-not-in-phantomjs
        # TODO(dcramer): this should be escaped, but idgaf
        self.driver.execute_script("document.cookie = '{name}={value}; path={path}; domain={domain}; expires={expires}';\n".format(
            name=name,
            value=value,
            expires=expires,
            path=path,
            domain=self.domain,
        ))


def pytest_addoption(parser):
    parser.addini('selenium_driver',
                  help='selenium driver (phantomjs or firefox)')

    group = parser.getgroup('selenium', 'selenium')
    group._addoption('--selenium-driver',
                     dest='selenium_driver',
                     help='selenium driver (phantomjs or firefox)')
    group._addoption('--phantomjs-path',
                     dest='phantomjs_path',
                     help='path to phantomjs driver')


def pytest_configure(config):
    if hasattr(config, 'slaveinput'):
        return  # xdist slave

    config.option.selenium_driver = config.getoption('selenium_driver') or \
        config.getini('selenium_driver') or \
        os.getenv('SELENIUM_DRIVER')


@pytest.fixture(scope='session')
def percy(request):
    import percy

    # Initialize Percy.
    loader = percy.ResourceLoader(
        root_dir=settings.STATIC_ROOT,
        base_url=quote(settings.STATIC_URL),
    )
    percy_config = percy.Config(default_widths=settings.PERCY_DEFAULT_TESTING_WIDTHS)
    percy = percy.Runner(loader=loader, config=percy_config)
    percy.initialize_build()

    request.addfinalizer(percy.finalize_build)
    return percy


@pytest.fixture(scope='function')
def browser(request, percy, live_server):
    driver_type = request.config.getoption('selenium_driver')
    if driver_type == 'firefox':
        driver = webdriver.Firefox()
    elif driver_type == 'phantomjs':
        phantomjs_path = request.config.getoption('phantomjs_path')
        if not phantomjs_path:
            phantomjs_path = os.path.join(
                'node_modules',
                'phantomjs-prebuilt',
                'bin',
                'phantomjs',
            )
        driver = webdriver.PhantomJS(executable_path=phantomjs_path)
        driver.set_window_size(1280, 800)
    else:
        raise pytest.UsageError('--driver must be specified')

    def fin():
        # Teardown Selenium.
        try:
            driver.close()
        except Exception:
            pass
        # TODO: remove this when fixed in: https://github.com/seleniumhq/selenium/issues/767
        if hasattr(driver, 'service'):
            driver.service.process.send_signal(signal.SIGTERM)
        driver.quit()

    request.node._driver = driver
    request.addfinalizer(fin)

    browser = Browser(driver, live_server, percy)

    if hasattr(request, 'cls'):
        request.cls.browser = browser
    request.node.browser = browser

    # bind webdriver to percy for snapshots
    percy.loader.webdriver = driver

    return driver


@pytest.fixture(scope='session', autouse=True)
def _environment(request):
    config = request.config
    # add environment details to the pytest-html plugin
    config._environment.append(('Driver', config.option.selenium_driver))


@pytest.mark.tryfirst
def pytest_runtest_makereport(item, call, __multicall__):
    report = __multicall__.execute()
    summary = []
    extra = getattr(report, 'extra', [])
    driver = getattr(item, '_driver', None)
    if driver is not None:
        _gather_url(item, report, driver, summary, extra)
        _gather_screenshot(item, report, driver, summary, extra)
        _gather_html(item, report, driver, summary, extra)
        _gather_logs(item, report, driver, summary, extra)
    if summary:
        report.sections.append(('selenium', '\n'.join(summary)))
    report.extra = extra
    return report


def _gather_url(item, report, driver, summary, extra):
    try:
        url = driver.current_url
    except Exception as e:
        summary.append('WARNING: Failed to gather URL: {0}'.format(e))
        return
    pytest_html = item.config.pluginmanager.getplugin('html')
    if pytest_html is not None:
        # add url to the html report
        extra.append(pytest_html.extras.url(url))
    summary.append('URL: {0}'.format(url))


def _gather_screenshot(item, report, driver, summary, extra):
    try:
        screenshot = driver.get_screenshot_as_base64()
    except Exception as e:
        summary.append('WARNING: Failed to gather screenshot: {0}'.format(e))
        return
    pytest_html = item.config.pluginmanager.getplugin('html')
    if pytest_html is not None:
        # add screenshot to the html report
        extra.append(pytest_html.extras.image(screenshot, 'Screenshot'))


def _gather_html(item, report, driver, summary, extra):
    try:
        html = driver.page_source.encode('utf-8')
    except Exception as e:
        summary.append('WARNING: Failed to gather HTML: {0}'.format(e))
        return
    pytest_html = item.config.pluginmanager.getplugin('html')
    if pytest_html is not None:
        # add page source to the html report
        extra.append(pytest_html.extras.text(html, 'HTML'))


def _gather_logs(item, report, driver, summary, extra):
    try:
        types = driver.log_types
    except Exception as e:
        # note that some drivers may not implement log types
        summary.append('WARNING: Failed to gather log types: {0}'.format(e))
        return
    for name in types:
        try:
            log = driver.get_log(name)
        except Exception as e:
            summary.append('WARNING: Failed to gather {0} log: {1}'.format(
                name, e))
            return
        pytest_html = item.config.pluginmanager.getplugin('html')
        if pytest_html is not None:
            extra.append(pytest_html.extras.text(
                format_log(log), '%s Log' % name.title()))


def format_log(log):
    timestamp_format = '%Y-%m-%d %H:%M:%S.%f'
    entries = [u'{0} {1[level]} - {1[message]}'.format(
        datetime.utcfromtimestamp(entry['timestamp'] / 1000.0).strftime(
            timestamp_format), entry).rstrip() for entry in log]
    log = '\n'.join(entries)
    log = log.encode('utf-8')
    return log
