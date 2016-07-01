from __future__ import absolute_import

import mock
import os
import pytest
import signal
import urllib

from datetime import datetime
from django.conf import settings
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions
from urlparse import urlparse


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


def pytest_configure(config):
    # HACK: Only needed for testing!
    os.environ.setdefault('_SENTRY_SKIP_CONFIGURATION', '1')

    os.environ.setdefault('RECAPTCHA_TESTING', 'True')
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentry.conf.server')

    if not settings.configured:
        # only configure the db if its not already done
        test_db = os.environ.get('DB', 'postgres')
        if test_db == 'mysql':
            settings.DATABASES['default'].update({
                'ENGINE': 'django.db.backends.mysql',
                'NAME': 'sentry',
                'USER': 'root',
                'HOST': '127.0.0.1',
            })
            # mysql requires running full migration all the time
            settings.SOUTH_TESTS_MIGRATE = True
        elif test_db == 'postgres':
            settings.DATABASES['default'].update({
                'ENGINE': 'sentry.db.postgres',
                'USER': 'postgres',
                'NAME': 'sentry',
            })
            # postgres requires running full migration all the time
            # since it has to install stored functions which come from
            # an actual migration.
            settings.SOUTH_TESTS_MIGRATE = True
        elif test_db == 'sqlite':
            settings.DATABASES['default'].update({
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': ':memory:',
            })
            settings.SOUTH_TESTS_MIGRATE = os.environ.get('SENTRY_SOUTH_TESTS_MIGRATE', '1') == '1'
        else:
            raise RuntimeError('oops, wrong database: %r' % test_db)

    settings.TEMPLATE_DEBUG = True

    # Disable static compiling in tests
    settings.STATIC_BUNDLES = {}

    # override a few things with our test specifics
    settings.INSTALLED_APPS = tuple(settings.INSTALLED_APPS) + (
        'tests',
    )
    # Need a predictable key for tests that involve checking signatures
    settings.SENTRY_PUBLIC = False

    if not settings.SENTRY_CACHE:
        settings.SENTRY_CACHE = 'sentry.cache.django.DjangoCache'
        settings.SENTRY_CACHE_OPTIONS = {}

    # This speeds up the tests considerably, pbkdf2 is by design, slow.
    settings.PASSWORD_HASHERS = [
        'django.contrib.auth.hashers.MD5PasswordHasher',
    ]

    # Replace real sudo middleware with our mock sudo middleware
    # to assert that the user is always in sudo mode
    middleware = list(settings.MIDDLEWARE_CLASSES)
    sudo = middleware.index('sentry.middleware.sudo.SudoMiddleware')
    middleware[sudo] = 'sentry.testutils.middleware.SudoMiddleware'
    settings.MIDDLEWARE_CLASSES = tuple(middleware)

    # enable draft features
    settings.SENTRY_OPTIONS['mail.enable-replies'] = True

    settings.SENTRY_ALLOW_ORIGIN = '*'

    settings.SENTRY_TSDB = 'sentry.tsdb.inmemory.InMemoryTSDB'
    settings.SENTRY_TSDB_OPTIONS = {}

    settings.RECAPTCHA_PUBLIC_KEY = 'a' * 40
    settings.RECAPTCHA_PRIVATE_KEY = 'b' * 40

    settings.BROKER_BACKEND = 'memory'
    settings.BROKER_URL = None
    settings.CELERY_ALWAYS_EAGER = False
    settings.CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

    settings.DEBUG_VIEWS = True

    settings.DISABLE_RAVEN = True

    settings.CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }

    if not hasattr(settings, 'SENTRY_OPTIONS'):
        settings.SENTRY_OPTIONS = {}

    settings.SENTRY_OPTIONS.update({
        'redis.clusters': {
            'default': {
                'hosts': {
                    0: {
                        'db': 9,
                    },
                },
            },
        },
        'mail.backend': 'django.core.mail.backends.locmem.EmailBackend',
        'system.url-prefix': 'http://testserver',
    })

    # django mail uses socket.getfqdn which doesn't play nice if our
    # networking isn't stable
    patcher = mock.patch('socket.getfqdn', return_value='localhost')
    patcher.start()

    from sentry.runner.initializer import (
        bootstrap_options, configure_structlog, initialize_receivers, fix_south,
        bind_cache_to_option_store)

    bootstrap_options(settings)
    configure_structlog()
    fix_south(settings)

    bind_cache_to_option_store()

    initialize_receivers()

    from sentry.utils.redis import clusters

    with clusters.get('default').all() as client:
        client.flushdb()

    # force celery registration
    from sentry.celery import app  # NOQA

    # disable DISALLOWED_IPS
    from sentry import http
    http.DISALLOWED_IPS = set()


def pytest_runtest_teardown(item):
    from sentry.app import tsdb
    tsdb.flush()

    from sentry.utils.redis import clusters

    with clusters.get('default').all() as client:
        client.flushdb()

    from celery.task.control import discard_all
    discard_all()


@pytest.fixture(scope='session')
def driver(request, live_server):
    # Initialize Selenium.
    # NOTE: this relies on the phantomjs binary packaged from npm to be in the right
    # location in node_modules.
    phantomjs_path = os.path.join(
        settings.NODE_MODULES_ROOT,
        'phantomjs-prebuilt',
        'bin',
        'phantomjs',
    )
    driver = webdriver.PhantomJS(executable_path=phantomjs_path)

    def fin():
        # Teardown Selenium.
        try:
            driver.close()
        except Exception:
            pass
        # TODO: remove this when fixed in: https://github.com/seleniumhq/selenium/issues/767
        driver.service.process.send_signal(signal.SIGTERM)
        driver.quit()

    request.session._driver = driver
    request.addfinalizer(fin)
    return driver


# TODO(dcramer): ideally we could bundle up more of the browser logic here
# rather than splitting it between the fixtures and AcceptanceTestCase
@pytest.fixture(scope='session')
def percy(request, driver):
    import percy

    # Initialize Percy.
    loader = percy.ResourceLoader(
        root_dir=settings.STATIC_ROOT,
        base_url=urllib.quote(settings.STATIC_URL),
        webdriver=driver,
    )
    percy_config = percy.Config(default_widths=settings.PERCY_DEFAULT_TESTING_WIDTHS)
    percy = percy.Runner(loader=loader, config=percy_config)
    percy.initialize_build()

    request.addfinalizer(percy.finalize_build)
    return percy


@pytest.fixture(scope='class')
def live_server_class(request, live_server):
    request.cls.live_server = live_server
    request.cls.live_server_url = live_server.url


@pytest.fixture(scope='class')
def browser_class(request, driver, live_server, percy):
    request.cls.browser = Browser(driver, live_server, percy)


@pytest.fixture(scope='class')
def percy_class(request, percy):
    request.cls.percy = percy


@pytest.fixture(scope='function')
def setup_selenium_session(request):
    driver = getattr(request.session, '_driver', None)
    if not driver:
        return
    driver.delete_all_cookies()


@pytest.mark.tryfirst
def pytest_runtest_makereport(item, call, __multicall__):
    report = __multicall__.execute()
    summary = []
    extra = getattr(report, 'extra', [])
    driver = getattr(item.session, '_driver', None)
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
