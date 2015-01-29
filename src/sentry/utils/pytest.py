from __future__ import absolute_import

import mock
import os

from django.conf import settings


def pytest_configure(config):
    os.environ['RECAPTCHA_TESTING'] = 'True'

    if not settings.configured:
        os.environ['DJANGO_SETTINGS_MODULE'] = 'sentry.conf.server'

        # only configure the db if its not already done
        test_db = os.environ.get('DB', 'sqlite')
        if test_db == 'mysql':
            settings.DATABASES['default'].update({
                'ENGINE': 'django.db.backends.mysql',
                'NAME': 'sentry',
                'USER': 'root',
            })
        elif test_db == 'postgres':
            settings.DATABASES['default'].update({
                'ENGINE': 'django.db.backends.postgresql_psycopg2',
                'USER': 'postgres',
                'NAME': 'sentry',
            })
        elif test_db == 'sqlite':
            settings.DATABASES['default'].update({
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': ':memory:',
            })

    # http://djangosnippets.org/snippets/646/
    class InvalidVarException(object):
        def __mod__(self, missing):
            try:
                missing_str = unicode(missing)
            except:
                missing_str = 'Failed to create string representation'
            raise Exception('Unknown template variable %r %s' % (missing, missing_str))

        def __contains__(self, search):
            if search == '%s':
                return True
            return False

    settings.TEMPLATE_DEBUG = True
    # settings.TEMPLATE_STRING_IF_INVALID = InvalidVarException()

    # Disable static compiling in tests
    settings.STATIC_BUNDLES = {}

    # override a few things with our test specifics
    settings.INSTALLED_APPS = tuple(settings.INSTALLED_APPS) + (
        'tests',
    )
    # Need a predictable key for tests that involve checking signatures
    settings.SENTRY_PUBLIC = False

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
    settings.SENTRY_ENABLE_EXPLORE_CODE = True
    settings.SENTRY_ENABLE_EXPLORE_USERS = True
    settings.SENTRY_ENABLE_EMAIL_REPLIES = True

    # disable error reporting by default
    settings.SENTRY_REDIS_OPTIONS = {'hosts': {0: {'db': 9}}}

    settings.SENTRY_ALLOW_ORIGIN = '*'

    settings.SENTRY_TSDB = 'sentry.tsdb.inmemory.InMemoryTSDB'
    settings.SENTRY_TSDB_OPTIONS = {}

    settings.RECAPTCHA_PUBLIC_KEY = 'a' * 40
    settings.RECAPTCHA_PRIVATE_KEY = 'b' * 40

    settings.CELERY_ALWAYS_EAGER = False

    settings.DISABLE_RAVEN = True

    settings.CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }

    # Disable South in tests as it is sending incorrect create signals
    settings.SOUTH_TESTS_MIGRATE = False

    # django mail uses socket.getfqdn which doesn't play nice if our
    # networking isn't stable
    patcher = mock.patch('socket.getfqdn', return_value='localhost')
    patcher.start()

    from sentry.utils.runner import initialize_receivers
    initialize_receivers()

    from sentry.testutils.cases import flush_redis
    flush_redis()


def pytest_runtest_teardown(item):
    from sentry.app import tsdb
    tsdb.flush()
