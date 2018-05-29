from __future__ import absolute_import

import mock
import os

from django.conf import settings

TEST_ROOT = os.path.normpath(
    os.path.join(
        os.path.dirname(__file__),
        os.pardir,
        os.pardir,
        os.pardir,
        os.pardir,
        'tests'))


def pytest_configure(config):
    # HACK: Only needed for testing!
    os.environ.setdefault('_SENTRY_SKIP_CONFIGURATION', '1')

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentry.conf.server')

    # override docs which are typically synchronized from an upstream server
    # to ensure tests are consistent
    os.environ.setdefault(
        'INTEGRATION_DOC_FOLDER',
        os.path.join(
            TEST_ROOT,
            'fixtures',
            'integration-docs'))
    from sentry.utils import integrationdocs
    integrationdocs.DOC_FOLDER = os.environ['INTEGRATION_DOC_FOLDER']

    if not settings.configured:
        # only configure the db if its not already done
        test_db = os.environ.get('DB', 'postgres')
        if test_db == 'mysql':
            settings.DATABASES['default'].update(
                {
                    'ENGINE': 'django.db.backends.mysql',
                    'NAME': 'sentry',
                    'USER': 'root',
                    'HOST': '127.0.0.1',
                }
            )
            # mysql requires running full migration all the time
        elif test_db == 'postgres':
            settings.DATABASES['default'].update(
                {
                    'ENGINE': 'sentry.db.postgres',
                    'USER': 'postgres',
                    'NAME': 'sentry',
                }
            )
            # postgres requires running full migration all the time
            # since it has to install stored functions which come from
            # an actual migration.
        elif test_db == 'sqlite':
            settings.DATABASES['default'].update(
                {
                    'ENGINE': 'django.db.backends.sqlite3',
                    'NAME': ':memory:',
                }
            )
        else:
            raise RuntimeError('oops, wrong database: %r' % test_db)

    settings.TEMPLATE_DEBUG = True

    # Disable static compiling in tests
    settings.STATIC_BUNDLES = {}

    # override a few things with our test specifics
    settings.INSTALLED_APPS = tuple(settings.INSTALLED_APPS) + ('tests', )
    # Need a predictable key for tests that involve checking signatures
    settings.SENTRY_PUBLIC = False

    if not settings.SENTRY_CACHE:
        settings.SENTRY_CACHE = 'sentry.cache.django.DjangoCache'
        settings.SENTRY_CACHE_OPTIONS = {}

    # This speeds up the tests considerably, pbkdf2 is by design, slow.
    settings.PASSWORD_HASHERS = [
        'django.contrib.auth.hashers.MD5PasswordHasher',
    ]

    settings.AUTH_PASSWORD_VALIDATORS = []

    # Replace real sudo middleware with our mock sudo middleware
    # to assert that the user is always in sudo mode
    middleware = list(settings.MIDDLEWARE_CLASSES)
    sudo = middleware.index('sentry.middleware.sudo.SudoMiddleware')
    middleware[sudo] = 'sentry.testutils.middleware.SudoMiddleware'
    settings.MIDDLEWARE_CLASSES = tuple(middleware)

    settings.SENTRY_OPTIONS['cloudflare.secret-key'] = 'cloudflare-secret-key'

    # enable draft features
    settings.SENTRY_OPTIONS['mail.enable-replies'] = True

    settings.SENTRY_ALLOW_ORIGIN = '*'

    settings.SENTRY_TSDB = 'sentry.tsdb.inmemory.InMemoryTSDB'
    settings.SENTRY_TSDB_OPTIONS = {}

    if settings.SENTRY_NEWSLETTER == 'sentry.newsletter.base.Newsletter':
        settings.SENTRY_NEWSLETTER = 'sentry.newsletter.dummy.DummyNewsletter'
        settings.SENTRY_NEWSLETTER_OPTIONS = {}

    settings.BROKER_BACKEND = 'memory'
    settings.BROKER_URL = None
    settings.CELERY_ALWAYS_EAGER = False
    settings.CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

    settings.DEBUG_VIEWS = True

    settings.SENTRY_ENCRYPTION_SCHEMES = ()

    settings.DISABLE_RAVEN = True

    settings.CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }

    if not hasattr(settings, 'SENTRY_OPTIONS'):
        settings.SENTRY_OPTIONS = {}

    settings.SENTRY_OPTIONS.update(
        {
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

            'slack.client-id': 'slack-client-id',
            'slack.client-secret': 'slack-client-secret',
            'slack.verification-token': 'slack-verification-token',

            'github-app.name': 'sentry-test-app',
            'github-app.client-id': 'github-client-id',
            'github-app.client-secret': 'github-client-secret',

            'vsts.client-id': 'vsts-client-id',
            'vsts.client-secret': 'vsts-client-secret',
        }
    )

    # django mail uses socket.getfqdn which doesn't play nice if our
    # networking isn't stable
    patcher = mock.patch('socket.getfqdn', return_value='localhost')
    patcher.start()

    if not settings.SOUTH_TESTS_MIGRATE:
        settings.INSTALLED_APPS = tuple(i for i in settings.INSTALLED_APPS if i != 'south')

    from sentry.runner.initializer import (
        bootstrap_options, configure_structlog, initialize_receivers, fix_south,
        bind_cache_to_option_store, setup_services
    )

    bootstrap_options(settings)
    configure_structlog()
    fix_south(settings)

    bind_cache_to_option_store()

    initialize_receivers()
    setup_services()
    register_extensions()

    from sentry.utils.redis import clusters

    with clusters.get('default').all() as client:
        client.flushdb()

    # force celery registration
    from sentry.celery import app  # NOQA

    # disable DISALLOWED_IPS
    from sentry import http
    http.DISALLOWED_IPS = set()


def register_extensions():
    from sentry.plugins import plugins
    from sentry.plugins.utils import TestIssuePlugin2

    plugins.register(TestIssuePlugin2)

    from sentry import integrations
    from sentry.integrations.bitbucket import BitbucketIntegrationProvider
    from sentry.integrations.example import ExampleIntegrationProvider
    from sentry.integrations.github import GitHubIntegrationProvider
    from sentry.integrations.github_enterprise import GitHubEnterpriseIntegrationProvider
    from sentry.integrations.jira import JiraIntegrationProvider
    from sentry.integrations.slack import SlackIntegrationProvider
    from sentry.integrations.vsts import VSTSIntegrationProvider
    integrations.register(BitbucketIntegrationProvider)
    integrations.register(ExampleIntegrationProvider)
    integrations.register(GitHubIntegrationProvider)
    integrations.register(GitHubEnterpriseIntegrationProvider)
    integrations.register(JiraIntegrationProvider)
    integrations.register(SlackIntegrationProvider)
    integrations.register(VSTSIntegrationProvider)

    from sentry.plugins import bindings
    from sentry.plugins.providers.dummy import DummyRepositoryProvider

    bindings.add('repository.provider', DummyRepositoryProvider, id='dummy')


def pytest_runtest_teardown(item):
    from sentry import tsdb
    # TODO(dcramer): this only works if this is the correct tsdb backend
    tsdb.flush()

    # XXX(dcramer): only works with DummyNewsletter
    from sentry import newsletter
    if hasattr(newsletter.backend, 'clear'):
        newsletter.backend.clear()

    from sentry.utils.redis import clusters

    with clusters.get('default').all() as client:
        client.flushdb()

    from celery.task.control import discard_all
    discard_all()
