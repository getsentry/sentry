from __future__ import absolute_import

import mock
import os
import pytest
import signal
import urllib

from datetime import datetime
from django.conf import settings
from selenium import webdriver


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
def browser(request, live_server):
    # Initialize Selenium.
    # NOTE: this relies on the phantomjs binary packaged from npm to be in the right
    # location in node_modules.
    phantomjs_path = os.path.join(
        settings.NODE_MODULES_ROOT,
        'phantomjs-prebuilt',
        'bin',
        'phantomjs',
    )
    browser = webdriver.PhantomJS(executable_path=phantomjs_path)

    def fin():
        # Teardown Selenium.
        try:
            browser.close()
        except Exception:
            pass
        # TODO: remove this when fixed in: https://github.com/seleniumhq/selenium/issues/767
        browser.service.process.send_signal(signal.SIGTERM)
        browser.quit()

    request.addfinalizer(fin)
    return browser


# TODO(dcramer): ideally we could bundle up more of the browser logic here
# rather than splitting it between the fixtures and AcceptanceTestCase
@pytest.fixture(scope='session')
def percy(request, browser):
    import percy

    # Initialize Percy.
    loader = percy.ResourceLoader(
        root_dir=settings.STATIC_ROOT,
        base_url=urllib.quote(settings.STATIC_URL),
        webdriver=browser,
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
def screenshots_path_class(request, browser):
    date = datetime.utcnow()
    # AcceptanceTestCase.snapshot saves local screenshots here
    path = os.path.normpath(os.path.join(
        os.path.dirname(__file__), os.pardir, os.pardir, os.pardir, 'tmp', 'selenium-screenshots', date.strftime('%s'))
    )
    print('Screenshots will be stored in {}'.format(path))
    os.makedirs(path)
    request.cls.screenshots_path = path


@pytest.fixture(scope='class')
def browser_class(request, browser):
    request.cls.browser = browser


@pytest.fixture(scope='class')
def percy_class(request, percy):
    request.cls.percy = percy


@pytest.fixture(scope='function')
def reset_browser_session(request):
    if not hasattr(request, 'browser'):
        return

    browser = request.browser

    browser.delete_all_cookies()
    browser.get('about:blank')
