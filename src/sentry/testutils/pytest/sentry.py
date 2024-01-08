from __future__ import annotations

import collections
import os
import random
import shutil
import string
import sys
from datetime import datetime
from hashlib import md5
from typing import TypeVar
from unittest import mock

import pytest
from django.conf import settings
from sentry_sdk import Hub

from sentry.runner.importer import install_plugin_apps
from sentry.testutils.region import TestEnvRegionDirectory
from sentry.types import region
from sentry.types.region import Region, RegionCategory
from sentry.utils.warnings import UnsupportedBackend

K = TypeVar("K")
V = TypeVar("V")

TEST_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir, os.pardir, "tests")
)

TEST_REDIS_DB = 9


def configure_split_db() -> None:
    SENTRY_USE_MONOLITH_DBS = os.environ.get("SENTRY_USE_MONOLITH_DBS", "0") == "1"
    already_configured = "control" in settings.DATABASES
    if already_configured or SENTRY_USE_MONOLITH_DBS:
        return

    # Add connections for the region & control silo databases.
    settings.DATABASES["control"] = settings.DATABASES["default"].copy()
    settings.DATABASES["control"]["NAME"] = "control"

    # Use the region database in the default connection as region
    # silo database is the 'default' elsewhere in application logic.
    settings.DATABASES["default"]["NAME"] = "region"

    settings.DATABASE_ROUTERS = ("sentry.db.router.SiloRouter",)


def _configure_test_env_regions() -> None:

    # Assign a random name on every test run, as a reminder that test setup and
    # assertions should not depend on this value. If you need to test behavior that
    # depends on region attributes, use `override_regions` in your test case.
    region_name = "testregion" + "".join(random.choices(string.digits, k=6))

    default_region = Region(
        region_name, 0, settings.SENTRY_OPTIONS["system.url-prefix"], RegionCategory.MULTI_TENANT
    )

    settings.SENTRY_REGION = region_name
    settings.SENTRY_MONOLITH_REGION = region_name

    # This not only populates the environment with the default region, but also
    # ensures that a TestEnvRegionDirectory instance is injected into global state.
    # See sentry.testutils.region.get_test_env_directory, which relies on it.
    region.set_global_directory(TestEnvRegionDirectory([default_region]))

    settings.SENTRY_SUBNET_SECRET = "secret"
    settings.SENTRY_CONTROL_ADDRESS = "http://controlserver/"


def pytest_configure(config: pytest.Config) -> None:
    import warnings

    # This is just to filter out an obvious warning before the pytest session starts.
    warnings.filterwarnings(
        action="ignore",
        message=r".*sentry.digests.backends.dummy.DummyBackend.*",
        category=UnsupportedBackend,
    )

    config.addinivalue_line("markers", "migrations: requires --migrations")

    if sys.platform == "darwin" and shutil.which("colima"):
        # This is the only way other than pytest --basetemp to change
        # the temproot. We'd like to keep invocations to just "pytest".
        # See source code for pytest's TempPathFactory.
        os.environ.setdefault("PYTEST_DEBUG_TEMPROOT", "/private/tmp/colima")
        try:
            os.mkdir("/private/tmp/colima")
        except FileExistsError:
            pass

    # HACK: Only needed for testing!
    os.environ.setdefault("_SENTRY_SKIP_CONFIGURATION", "1")

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sentry.conf.server")

    # override docs which are typically synchronized from an upstream server
    # to ensure tests are consistent
    os.environ.setdefault(
        "INTEGRATION_DOC_FOLDER", os.path.join(TEST_ROOT, os.pardir, "fixtures", "integration-docs")
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

    configure_split_db()

    # Ensure we can test secure ssl settings
    settings.SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    # silence (noisy) loggers by default when testing
    settings.LOGGING["loggers"]["sentry"]["level"] = "ERROR"

    # Disable static compiling in tests
    settings.STATIC_BUNDLES = {}

    # override a few things with our test specifics
    install_plugin_apps("sentry.apps", settings)
    settings.INSTALLED_APPS = tuple(settings.INSTALLED_APPS) + ("fixtures",)
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
    middleware = list(settings.MIDDLEWARE)
    sudo = middleware.index("sentry.middleware.sudo.SudoMiddleware")
    middleware[sudo] = "sentry.testutils.middleware.SudoMiddleware"
    settings.MIDDLEWARE = tuple(middleware)

    # enable draft features
    settings.SENTRY_OPTIONS["mail.enable-replies"] = True

    settings.SENTRY_ALLOW_ORIGIN = "*"

    settings.SENTRY_TSDB = "sentry.tsdb.redissnuba.RedisSnubaTSDB"
    settings.SENTRY_TSDB_OPTIONS = {}

    settings.SENTRY_NEWSLETTER = "sentry.newsletter.dummy.DummyNewsletter"
    settings.SENTRY_NEWSLETTER_OPTIONS = {}

    settings.BROKER_BACKEND = "memory"
    settings.BROKER_URL = "memory://"
    settings.CELERY_ALWAYS_EAGER = False
    settings.CELERY_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE = True
    settings.CELERY_EAGER_PROPAGATES_EXCEPTIONS = True
    settings.SENTRY_METRICS_DISALLOW_BAD_TAGS = True

    settings.DEBUG_VIEWS = True
    settings.SERVE_UPLOADED_FILES = True

    # Disable internal error collection during tests.
    settings.SENTRY_PROJECT = None
    settings.SENTRY_PROJECT_KEY = None

    settings.SENTRY_ENCRYPTION_SCHEMES = ()

    settings.CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
        "nodedata": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    }

    settings.SENTRY_RATELIMITER = "sentry.ratelimits.redis.RedisRateLimiter"
    settings.SENTRY_RATELIMITER_OPTIONS = {}

    settings.SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT = 1

    if not hasattr(settings, "SENTRY_OPTIONS"):
        settings.SENTRY_OPTIONS = {}

    settings.SENTRY_OPTIONS.update(
        {
            "redis.clusters": {"default": {"hosts": {0: {"db": TEST_REDIS_DB}}}},
            "mail.backend": "django.core.mail.backends.locmem.EmailBackend",
            "system.url-prefix": "http://testserver",
            "system.base-hostname": "testserver",
            "system.organization-base-hostname": "{slug}.testserver",
            "system.organization-url-template": "http://{hostname}",
            "system.region-api-url-template": "http://{region}.testserver",
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
    settings.SENTRY_OPTIONS_COMPLAIN_ON_ERRORS = True
    settings.VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON = False

    _configure_test_env_regions()

    # ID controls
    settings.SENTRY_USE_BIG_INTS = True
    settings.SENTRY_USE_SNOWFLAKE = True
    settings.SENTRY_SNOWFLAKE_EPOCH_START = datetime(1999, 12, 31, 0, 0).timestamp()

    # Plugin-related settings
    settings.ASANA_CLIENT_ID = "abc"
    settings.ASANA_CLIENT_SECRET = "123"
    settings.BITBUCKET_CONSUMER_KEY = "abc"
    settings.BITBUCKET_CONSUMER_SECRET = "123"
    settings.SENTRY_OPTIONS["github-login.client-id"] = "abc"
    settings.SENTRY_OPTIONS["github-login.client-secret"] = "123"
    # this isn't the real secret
    settings.SENTRY_OPTIONS["github.integration-hook-secret"] = "b3002c3e321d4b7880360d397db2ccfd"

    # Configure control backend settings for storage
    settings.SENTRY_OPTIONS["filestore.control.backend"] = "filesystem"
    settings.SENTRY_OPTIONS["filestore.control.options"] = {"location": "/tmp/sentry-files"}

    # This is so tests can assume this feature is off by default
    settings.SENTRY_FEATURES["organizations:performance-view"] = False

    # If a request hits the wrong silo, replace the 404 response with an error state
    settings.FAIL_ON_UNAVAILABLE_API_CALL = True

    settings.SENTRY_USE_ISSUE_OCCURRENCE = True

    settings.SENTRY_USE_GROUP_ATTRIBUTES = True

    # For now, multiprocessing does not work in tests.
    settings.KAFKA_CONSUMER_FORCE_DISABLE_MULTIPROCESSING = True

    # Assume this is always configured (not the real secret)
    settings.RPC_SHARED_SECRET = ("215b1f0d",)

    # django mail uses socket.getfqdn which doesn't play nice if our
    # networking isn't stable
    patcher = mock.patch("socket.getfqdn", return_value="localhost")
    patcher.start()

    asset_version_patcher = mock.patch(
        "sentry.runner.initializer.get_asset_version", return_value="{version}"
    )
    asset_version_patcher.start()
    from sentry.runner.initializer import initialize_app

    initialize_app({"settings": settings, "options": None})
    Hub.main.bind_client(None)
    register_extensions()

    from sentry.utils.redis import clusters

    with clusters.get("default").all() as client:
        client.flushdb()

    # force celery registration
    from sentry.celery import app  # NOQA


def register_extensions() -> None:
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


def pytest_runtest_setup(item: pytest.Item) -> None:
    if item.config.getvalue("nomigrations") and any(
        mark for mark in item.iter_markers(name="migrations")
    ):
        pytest.skip("migrations are not enabled, run with `pytest --migrations ...`")


def pytest_runtest_teardown(item: pytest.Item) -> None:
    # XXX(dcramer): only works with DummyNewsletter
    from sentry import newsletter

    if hasattr(newsletter.backend, "clear"):
        newsletter.backend.clear()

    from sentry.utils.redis import clusters

    with clusters.get("default").all() as client:
        client.flushdb()

    from celery.app.control import Control

    from sentry.celery import app

    celery_app_control = Control(app)
    celery_app_control.discard_all()

    from sentry.models.options.organization_option import OrganizationOption
    from sentry.models.options.project_option import ProjectOption
    from sentry.models.options.user_option import UserOption

    for model in (OrganizationOption, ProjectOption, UserOption):
        model.objects.clear_local_cache()

    Hub.main.bind_client(None)


def _shuffle(items: list[pytest.Item]) -> None:
    # goal: keep classes together, keep modules together but otherwise shuffle
    # this prevents duplicate setup/teardown work
    nodes: dict[str, dict[str, pytest.Item | dict[str, pytest.Item]]]
    nodes = collections.defaultdict(dict)
    for item in items:
        parts = item.nodeid.split("::", maxsplit=2)
        if len(parts) == 2:
            nodes[parts[0]][parts[1]] = item
        elif len(parts) == 3:
            subnodes = nodes[parts[0]].setdefault(parts[1], {})
            assert isinstance(subnodes, dict)
            subnodes[parts[2]] = item
        else:
            raise AssertionError(f"unexpected nodeid: {item.nodeid}")

    def _shuffle_d(dct: dict[K, V]) -> dict[K, V]:
        return dict(random.sample(tuple(dct.items()), len(dct)))

    new_items = []
    for first_v in _shuffle_d(nodes).values():
        for second_v in _shuffle_d(first_v).values():
            if isinstance(second_v, dict):
                for item in _shuffle_d(second_v).values():
                    new_items.append(item)
            else:
                new_items.append(second_v)

    assert len(new_items) == len(items)
    items[:] = new_items


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """After collection, we need to select tests based on group and group strategy"""

    total_groups = int(os.environ.get("TOTAL_TEST_GROUPS", 1))
    current_group = int(os.environ.get("TEST_GROUP", 0))
    grouping_strategy = os.environ.get("TEST_GROUP_STRATEGY", "scope")

    keep, discard = [], []

    for index, item in enumerate(items):
        # In the case where we group by round robin (e.g. TEST_GROUP_STRATEGY is not `file`),
        # we want to only include items in `accepted` list
        item_to_group = (
            int(md5(item.nodeid.rsplit("::", 1)[0].encode()).hexdigest(), 16)
            if grouping_strategy == "scope"
            else index
        )

        # Split tests in different groups
        group_num = item_to_group % total_groups

        if group_num == current_group:
            keep.append(item)
        else:
            discard.append(item)

    items[:] = keep

    if os.environ.get("SENTRY_SHUFFLE_TESTS"):
        _shuffle(items)

    # This only needs to be done if there are items to be de-selected
    if len(discard) > 0:
        config.hook.pytest_deselected(items=discard)


def pytest_xdist_setupnodes() -> None:
    # prevent out-of-order django initialization
    os.environ.pop("DJANGO_SETTINGS_MODULE", None)
