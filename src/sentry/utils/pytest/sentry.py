from __future__ import absolute_import

from sentry.utils.compat import mock
import os
from hashlib import md5

from django.conf import settings
from sentry_sdk import Hub

import six

TEST_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir, os.pardir, "tests")
)


def pytest_configure(config):
    # HACK: Only needed for testing!
    os.environ.setdefault("_SENTRY_SKIP_CONFIGURATION", "1")

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sentry.conf.server")

    # override docs which are typically synchronized from an upstream server
    # to ensure tests are consistent
    os.environ.setdefault(
        "INTEGRATION_DOC_FOLDER", os.path.join(TEST_ROOT, "fixtures", "integration-docs")
    )
    from sentry.utils import integrationdocs

    integrationdocs.DOC_FOLDER = os.environ["INTEGRATION_DOC_FOLDER"]

    if not settings.configured:
        # only configure the db if its not already done
        test_db = os.environ.get("DB", "postgres")
        if test_db == "postgres":
            settings.DATABASES["default"].update(
                {
                    "ENGINE": "sentry.db.postgres",
                    "USER": "postgres",
                    "NAME": "sentry",
                    "HOST": "127.0.0.1",
                }
            )
            settings.DATABASES["file"] = settings.DATABASES["default"].copy()
            settings.DATABASES["file"]["NAME"] = "sentry_file"
            # postgres requires running full migration all the time
            # since it has to install stored functions which come from
            # an actual migration.
            settings.DATABASE_ROUTERS = ("sentry.routers.MultiDatabaseRouter",)

            # patch TestCase to account for multiple databases
            from django.test import TestCase

            TestCase.multi_db = True
        else:
            raise RuntimeError("oops, wrong database: %r" % test_db)

    # Disable static compiling in tests
    settings.STATIC_BUNDLES = {}

    # override a few things with our test specifics
    settings.INSTALLED_APPS = tuple(settings.INSTALLED_APPS) + ("tests",)
    # Need a predictable key for tests that involve checking signatures
    settings.SENTRY_PUBLIC = False

    if not settings.SENTRY_CACHE:
        settings.SENTRY_CACHE = "sentry.cache.django.DjangoCache"
        settings.SENTRY_CACHE_OPTIONS = {}

    # This speeds up the tests considerably, pbkdf2 is by design, slow.
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

    settings.AUTH_PASSWORD_VALIDATORS = []

    # Replace real sudo middleware with our mock sudo middleware
    # to assert that the user is always in sudo mode
    middleware = list(settings.MIDDLEWARE_CLASSES)
    sudo = middleware.index("sentry.middleware.sudo.SudoMiddleware")
    middleware[sudo] = "sentry.testutils.middleware.SudoMiddleware"
    settings.MIDDLEWARE_CLASSES = tuple(middleware)

    settings.SENTRY_OPTIONS["cloudflare.secret-key"] = "cloudflare-secret-key"

    # enable draft features
    settings.SENTRY_OPTIONS["mail.enable-replies"] = True

    settings.SENTRY_ALLOW_ORIGIN = "*"

    settings.SENTRY_TSDB = "sentry.tsdb.inmemory.InMemoryTSDB"
    settings.SENTRY_TSDB_OPTIONS = {}

    if settings.SENTRY_NEWSLETTER == "sentry.newsletter.base.Newsletter":
        settings.SENTRY_NEWSLETTER = "sentry.newsletter.dummy.DummyNewsletter"
        settings.SENTRY_NEWSLETTER_OPTIONS = {}

    settings.BROKER_BACKEND = "memory"
    settings.BROKER_URL = "memory://"
    settings.CELERY_ALWAYS_EAGER = False
    settings.CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

    settings.DEBUG_VIEWS = True

    settings.SENTRY_ENCRYPTION_SCHEMES = ()

    settings.DISABLE_RAVEN = True

    settings.CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
        "nodedata": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    }

    settings.SENTRY_RATELIMITER = "sentry.ratelimits.redis.RedisRateLimiter"
    settings.SENTRY_RATELIMITER_OPTIONS = {}

    if os.environ.get("USE_SNUBA", False):
        settings.SENTRY_SEARCH = "sentry.search.snuba.EventsDatasetSnubaSearchBackend"
        settings.SENTRY_TSDB = "sentry.tsdb.redissnuba.RedisSnubaTSDB"
        settings.SENTRY_EVENTSTREAM = "sentry.eventstream.snuba.SnubaEventStream"

    if not hasattr(settings, "SENTRY_OPTIONS"):
        settings.SENTRY_OPTIONS = {}

    settings.SENTRY_OPTIONS.update(
        {
            "redis.clusters": {"default": {"hosts": {0: {"db": 9}}}},
            "mail.backend": "django.core.mail.backends.locmem.EmailBackend",
            "system.url-prefix": "http://testserver",
            "slack.client-id": "slack-client-id",
            "slack.client-secret": "slack-client-secret",
            "slack.verification-token": "slack-verification-token",
            "slack.legacy-app": True,
            "github-app.name": "sentry-test-app",
            "github-app.client-id": "github-client-id",
            "github-app.client-secret": "github-client-secret",
            "vsts.client-id": "vsts-client-id",
            "vsts.client-secret": "vsts-client-secret",
            "vsts-limited.client-id": "vsts-limited-client-id",
            "vsts-limited.client-secret": "vsts-limited-client-secret",
            "vercel.client-id": "vercel-client-id",
            "vercel.client-secret": "vercel-client-secret",
            "msteams.client-id": "msteams-client-id",
            "msteams.client-secret": "msteams-client-secret",
        }
    )

    # django mail uses socket.getfqdn which doesn't play nice if our
    # networking isn't stable
    patcher = mock.patch("socket.getfqdn", return_value="localhost")
    patcher.start()

    if not settings.MIGRATIONS_TEST_MIGRATE:
        # Migrations for the "sentry" app take a long time to run, which makes test startup time slow in dev.
        # This is a hack to force django to sync the database state from the models rather than use migrations.
        settings.MIGRATION_MODULES["sentry"] = None

    from sentry.runner.initializer import (
        bind_cache_to_option_store,
        bootstrap_options,
        configure_structlog,
        initialize_receivers,
        monkeypatch_model_unpickle,
        monkeypatch_django_migrations,
        setup_services,
    )

    bootstrap_options(settings)
    configure_structlog()

    monkeypatch_model_unpickle()

    import django

    django.setup()

    monkeypatch_django_migrations()

    bind_cache_to_option_store()

    initialize_receivers()
    setup_services()
    register_extensions()

    from sentry.utils.redis import clusters

    with clusters.get("default").all() as client:
        client.flushdb()

    # force celery registration
    from sentry.celery import app  # NOQA

    # disable DISALLOWED_IPS
    from sentry import http

    http.DISALLOWED_IPS = set()


def register_extensions():
    from sentry.plugins.base import plugins
    from sentry.plugins.utils import TestIssuePlugin2

    plugins.register(TestIssuePlugin2)

    from sentry import integrations
    from sentry.integrations.bitbucket import BitbucketIntegrationProvider
    from sentry.integrations.bitbucket_server import BitbucketServerIntegrationProvider
    from sentry.integrations.example import (
        ExampleIntegrationProvider,
        AliasedIntegrationProvider,
        ExampleRepositoryProvider,
        ServerExampleProvider,
        FeatureFlagIntegration,
    )
    from sentry.integrations.github import GitHubIntegrationProvider
    from sentry.integrations.github_enterprise import GitHubEnterpriseIntegrationProvider
    from sentry.integrations.gitlab import GitlabIntegrationProvider
    from sentry.integrations.jira import JiraIntegrationProvider
    from sentry.integrations.jira_server import JiraServerIntegrationProvider
    from sentry.integrations.slack import SlackIntegrationProvider
    from sentry.integrations.vsts import VstsIntegrationProvider
    from sentry.integrations.vsts_extension import VstsExtensionIntegrationProvider
    from sentry.integrations.pagerduty.integration import PagerDutyIntegrationProvider

    integrations.register(BitbucketIntegrationProvider)
    integrations.register(BitbucketServerIntegrationProvider)
    integrations.register(ExampleIntegrationProvider)
    integrations.register(AliasedIntegrationProvider)
    integrations.register(ServerExampleProvider)
    integrations.register(FeatureFlagIntegration)
    integrations.register(GitHubIntegrationProvider)
    integrations.register(GitHubEnterpriseIntegrationProvider)
    integrations.register(GitlabIntegrationProvider)
    integrations.register(JiraIntegrationProvider)
    integrations.register(JiraServerIntegrationProvider)
    integrations.register(SlackIntegrationProvider)
    integrations.register(VstsIntegrationProvider)
    integrations.register(VstsExtensionIntegrationProvider)
    integrations.register(PagerDutyIntegrationProvider)

    from sentry.plugins.base import bindings
    from sentry.plugins.providers.dummy import DummyRepositoryProvider

    bindings.add("repository.provider", DummyRepositoryProvider, id="dummy")
    bindings.add(
        "integration-repository.provider", ExampleRepositoryProvider, id="integrations:example"
    )


def pytest_runtest_teardown(item):
    if not os.environ.get("USE_SNUBA", False):
        from sentry import tsdb

        # TODO(dcramer): this only works if this is the correct tsdb backend
        tsdb.flush()

    # XXX(dcramer): only works with DummyNewsletter
    from sentry import newsletter

    if hasattr(newsletter.backend, "clear"):
        newsletter.backend.clear()

    from sentry.utils.redis import clusters

    with clusters.get("default").all() as client:
        client.flushdb()

    from celery.task.control import discard_all

    discard_all()

    from sentry.models import OrganizationOption, ProjectOption, UserOption

    for model in (OrganizationOption, ProjectOption, UserOption):
        model.objects.clear_local_cache()

    Hub.main.bind_client(None)


def pytest_collection_modifyitems(config, items):
    """
    After collection, we need to:

    - Filter tests that subclass SnubaTestCase as tests in `tests/acceptance` are not being marked as `snuba`
    - Select tests based on group and group strategy

    """

    total_groups = int(os.environ.get("TOTAL_TEST_GROUPS", 1))
    current_group = int(os.environ.get("TEST_GROUP", 0))
    grouping_strategy = os.environ.get("TEST_GROUP_STRATEGY", "file")

    accepted, keep, discard = [], [], []

    for index, item in enumerate(items):
        # XXX: For some reason tests in `tests/acceptance` are not being
        # marked as snuba, so deselect test cases not a subclass of SnubaTestCase
        if os.environ.get("RUN_SNUBA_TESTS_ONLY"):
            from sentry.testutils import SnubaTestCase
            import inspect

            if inspect.isclass(item.cls) and not issubclass(item.cls, SnubaTestCase):
                # No need to group if we are deselecting this
                discard.append(item)
                continue
            accepted.append(item)
        else:
            accepted.append(item)

        # In the case where we group by round robin (e.g. TEST_GROUP_STRATEGY is not `file`),
        # we want to only include items in `accepted` list

        # TODO(joshuarli): six 1.12.0 adds ensure_binary: six.ensure_binary(item.location[0])
        item_to_group = (
            int(md5(six.text_type(item.location[0]).encode("utf-8")).hexdigest(), 16)
            if grouping_strategy == "file"
            else len(accepted) - 1
        )

        # Split tests in different groups
        group_num = item_to_group % total_groups

        if group_num == current_group:
            keep.append(item)
        else:
            discard.append(item)

    # This only needs to be done if there are items to be de-selected
    if len(discard) > 0:
        items[:] = keep
        config.hook.pytest_deselected(items=discard)
