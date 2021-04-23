import os
from hashlib import md5

from django.conf import settings
from sentry_sdk import Hub

from sentry.utils.compat import mock
from sentry.utils.warnings import UnsupportedBackend

TEST_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir, os.pardir, "tests")
)


def pytest_configure(config):
    import warnings

    from django.utils.deprecation import RemovedInDjango20Warning, RemovedInDjango21Warning

    # These warnings should be kept in sync with sentry.runner.settings,
    # and pytest warningfilters in pyproject.toml.
    # See pyproject.toml for explanations.
    warnings.filterwarnings(action="ignore", category=RemovedInDjango20Warning)
    warnings.filterwarnings(action="ignore", category=RemovedInDjango21Warning)
    warnings.filterwarnings(action="ignore", category=DeprecationWarning)

    # These warnings are for pytest only.
    warnings.filterwarnings(
        action="ignore",
        message=r".*sentry.digests.backends.dummy.DummyBackend.*",
        category=UnsupportedBackend,
    )

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
            # postgres requires running full migration all the time
            # since it has to install stored functions which come from
            # an actual migration.
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

    settings.SENTRY_NEWSLETTER = "sentry.newsletter.dummy.DummyNewsletter"
    settings.SENTRY_NEWSLETTER_OPTIONS = {}

    settings.BROKER_BACKEND = "memory"
    settings.BROKER_URL = "memory://"
    settings.CELERY_ALWAYS_EAGER = False
    settings.CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

    settings.DEBUG_VIEWS = True
    settings.SERVE_UPLOADED_FILES = True

    settings.SENTRY_ENCRYPTION_SCHEMES = ()

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

    if os.environ.get("DISABLE_TEST_SDK", False):
        settings.SENTRY_SDK_CONFIG = {}

    if not hasattr(settings, "SENTRY_OPTIONS"):
        settings.SENTRY_OPTIONS = {}

    settings.SENTRY_OPTIONS.update(
        {
            "redis.clusters": {"default": {"hosts": {0: {"db": 9}}}},
            "mail.backend": "django.core.mail.backends.locmem.EmailBackend",
            "system.url-prefix": "http://testserver",
            "system.secret-key": "a" * 52,
            "slack.client-id": "slack-client-id",
            "slack.client-secret": "slack-client-secret",
            "slack.verification-token": "slack-verification-token",
            "slack.signing-secret": "slack-signing-secret",
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
            "aws-lambda.access-key-id": "aws-key-id",
            "aws-lambda.secret-access-key": "aws-secret-access-key",
            "aws-lambda.cloudformation-url": "https://example.com/file.json",
            "aws-lambda.account-number": "1234",
            "aws-lambda.node.layer-name": "my-layer",
            "aws-lambda.node.layer-version": "3",
            "aws-lambda.python.layer-name": "my-python-layer",
            "aws-lambda.python.layer-version": "34",
        }
    )

    # Plugin-related settings
    settings.ASANA_CLIENT_ID = "abc"
    settings.ASANA_CLIENT_SECRET = "123"
    settings.BITBUCKET_CONSUMER_KEY = "abc"
    settings.BITBUCKET_CONSUMER_SECRET = "123"
    settings.GITHUB_APP_ID = "abc"
    settings.GITHUB_API_SECRET = "123"
    # this isn't the real secret
    settings.SENTRY_OPTIONS["github.integration-hook-secret"] = "b3002c3e321d4b7880360d397db2ccfd"

    # django mail uses socket.getfqdn which doesn't play nice if our
    # networking isn't stable
    patcher = mock.patch("socket.getfqdn", return_value="localhost")
    patcher.start()

    if not settings.MIGRATIONS_TEST_MIGRATE:
        # Migrations for the "sentry" app take a long time to run, which makes test startup time slow in dev.
        # This is a hack to force django to sync the database state from the models rather than use migrations.
        settings.MIGRATION_MODULES["sentry"] = None

    asset_version_patcher = mock.patch(
        "sentry.runner.initializer.get_asset_version", return_value="{version}"
    )
    asset_version_patcher.start()
    from sentry.runner.initializer import initialize_app

    initialize_app({"settings": settings, "options": None})
    register_extensions()

    from sentry.utils.redis import clusters

    with clusters.get("default").all() as client:
        client.flushdb()

    # force celery registration
    # disable DISALLOWED_IPS
    from sentry import http
    from sentry.celery import app  # NOQA

    http.DISALLOWED_IPS = set()


def register_extensions():
    from sentry.plugins.base import plugins
    from sentry.plugins.utils import TestIssuePlugin2

    plugins.register(TestIssuePlugin2)

    from sentry import integrations
    from sentry.integrations.example import (
        AlertRuleIntegrationProvider,
        AliasedIntegrationProvider,
        ExampleIntegrationProvider,
        ExampleRepositoryProvider,
        FeatureFlagIntegration,
        ServerExampleProvider,
    )

    integrations.register(ExampleIntegrationProvider)
    integrations.register(AliasedIntegrationProvider)
    integrations.register(ServerExampleProvider)
    integrations.register(FeatureFlagIntegration)
    integrations.register(AlertRuleIntegrationProvider)

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
            import inspect

            from sentry.testutils import SnubaTestCase

            if inspect.isclass(item.cls) and not issubclass(item.cls, SnubaTestCase):
                # No need to group if we are deselecting this
                discard.append(item)
                continue
            accepted.append(item)
        else:
            accepted.append(item)

        # In the case where we group by round robin (e.g. TEST_GROUP_STRATEGY is not `file`),
        # we want to only include items in `accepted` list
        item_to_group = (
            int(md5(str(item.location[0]).encode("utf-8")).hexdigest(), 16)
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
