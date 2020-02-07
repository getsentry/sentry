from __future__ import absolute_import

import os
import sys
from hashlib import md5

import pytest

pytest_plugins = ["sentry.utils.pytest"]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def pytest_configure(config):
    import warnings

    # XXX(dramer): Kombu throws a warning due to transaction.commit_manually
    # being used
    warnings.filterwarnings("error", "", Warning, r"^(?!(|kombu|raven|sentry))")

    # always install plugins for the tests
    install_sentry_plugins()


def install_sentry_plugins():
    # Sentry's pytest plugin explicitly doesn't load plugins, so let's load all of them
    # and ignore the fact that we're not *just* testing our own
    # Note: We could manually register/configure INSTALLED_APPS by traversing our entry points
    # or package directories, but this is easier assuming Sentry doesn't change APIs.
    # Note: Order of operations matters here.
    from sentry.runner.importer import install_plugin_apps
    from django.conf import settings

    install_plugin_apps("sentry.apps", settings)

    from sentry.runner.initializer import register_plugins

    register_plugins(settings, raise_on_plugin_load_failure=True)

    settings.ASANA_CLIENT_ID = "abc"
    settings.ASANA_CLIENT_SECRET = "123"
    settings.BITBUCKET_CONSUMER_KEY = "abc"
    settings.BITBUCKET_CONSUMER_SECRET = "123"
    settings.GITHUB_APP_ID = "abc"
    settings.GITHUB_API_SECRET = "123"
    # this isn't the real secret
    settings.SENTRY_OPTIONS["github.integration-hook-secret"] = "b3002c3e321d4b7880360d397db2ccfd"


def pytest_collection_modifyitems(config, items):
    for item in items:
        total_groups = int(os.environ.get("TOTAL_TEST_GROUPS", 1))
        group_num = int(md5(item.location[0]).hexdigest(), 16) % total_groups
        marker = "group_%s" % group_num
        config.addinivalue_line("markers", marker)
        item.add_marker(getattr(pytest.mark, marker))


# TODO(dcramer): this shouhld go into tests/symbolicator/conftest.py, but fails currently:
# ImportError while loading conftest '/Users/dcramer/Development/sentry/tests/symbolicator/conftest.py'.
# tests/symbolicator/__init__.py:5: in <module>
#     from sentry.utils.safe import get_path
# src/sentry/utils/safe.py:49: in <module>
#     max_size=settings.SENTRY_MAX_VARIABLE_SIZE,
# ../../.virtualenvs/sentry/lib/python2.7/site-packages/django/conf/__init__.py:56: in __getattr__
#     self._setup(name)
# ../../.virtualenvs/sentry/lib/python2.7/site-packages/django/conf/__init__.py:39: in _setup
#     % (desc, ENVIRONMENT_VARIABLE))
# E   ImproperlyConfigured: Requested setting SENTRY_MAX_VARIABLE_SIZE, but settings are not configured. You must either define the environment variable DJANGO_SETTINGS_MODULE or call settings.configure() before accessing settings.
@pytest.fixture(autouse=True)
def add_passthru_for_symbolicator(responses):
    responses.add_passthru("http://localhost:3021")


@pytest.fixture(autouse=True)
def add_mock_for_snuba(responses):
    responses.add_passthru("http://localhost:1218")
