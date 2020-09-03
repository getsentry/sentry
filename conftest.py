from __future__ import absolute_import

import os
import sys
from hashlib import md5

import six
import pytest
import sentry_sdk
from sentry_sdk import Hub, start_transaction


pytest_plugins = ["sentry.utils.pytest"]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

if os.environ.get("PYTEST_SENTRY_DSN"):
    sentry_sdk.init(os.environ.get("PYTEST_SENTRY_DSN"), traces_sample_rate=1.0)

test = sentry_sdk.init(
    debug=True,
    dsn="https://24f526f0cefc4083b2546207a3f6811d@o19635.ingest.sentry.io/5415672",
    traces_sample_rate=1.0,
)
print(dir(test))


txn = {}
spans = {}


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_setup(item):
    transaction = txn.get(item.module.__name__)
    if transaction is None:
        transaction = Hub.current.start_transaction(name=item.module.__name__)
        # Hub.current.scope.transaction is None here??
        txn[item.module.__name__] = transaction

    with transaction.start_child(op="pytest.setup", description=item.name):
        yield


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item):
    transaction = txn.get(item.module.__name__)
    if transaction:
        with transaction.start_child(op="pytest.call", description=item.name):
            yield
    else:
        print("$$$$$ NO TRANSACTION")
        yield


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_teardown(item, nextitem):
    transaction = txn.get(item.module.__name__)

    if transaction:
        with transaction.start_child(op="pytest.teardown", description=item.name):
            yield
    else:
        yield

    if nextitem is None:
        #  transaction = Hub.current.scope.transaction
        if transaction:
            # XXX client is None here and transaction is unable to finish
            print(Hub.current.client, transaction.hub.client)
            transaction.finish()
            txn.pop(item.module.__name__)


def pytest_configure(config):
    import warnings

    # XXX(dcramer): Kombu throws a warning due to transaction.commit_manually
    # being used
    warnings.filterwarnings("error", "", Warning, r"^(?!(|kombu|raven|sentry))")

    # always install plugins for the tests
    install_sentry_plugins()

    config.addinivalue_line("markers", "obsolete: mark test as obsolete and soon to be removed")


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
        # TODO(joshuarli): six 1.12.0 adds ensure_binary: six.ensure_binary(item.location[0])
        group_num = (
            int(md5(six.text_type(item.location[0]).encode("utf-8")).hexdigest(), 16) % total_groups
        )
        marker = "group_%s" % group_num
        config.addinivalue_line("markers", marker)
        item.add_marker(getattr(pytest.mark, marker))
