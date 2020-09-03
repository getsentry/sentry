from __future__ import absolute_import

import os
import sys
from hashlib import md5

import six
import pytest
import sentry_sdk
from sentry_sdk import Hub, Client


pytest_plugins = ["sentry.utils.pytest"]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

#  if os.environ.get("PYTEST_SENTRY_DSN"):
#  sentry_sdk.init(os.environ.get("PYTEST_SENTRY_DSN"), traces_sample_rate=1.0)


hub = Hub(
    Client(
        dsn="https://24f526f0cefc4083b2546207a3f6811d@o19635.ingest.sentry.io/5415672",
        traces_sample_rate=1.0,
        _experiments={"auto_enabling_integrations": True},
    )
)

# each file will be considered a transaction
transaction = None

# Map of <test item name, Span<pytest.setup>>
spans = {}

# Map of <test item name, Span<pytest.call>>
call_spans = {}


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_protocol(item):
    mark = next(x for x in item.own_markers if x.name.startswith("group_"))

    global transaction
    if transaction is None:
        name = u"{} [{}]".format(item.module.__name__, mark.name)
        transaction = hub.start_transaction(op=name, name=name).__enter__()

    with transaction.start_child(hub=hub, op=item.name):
        yield

    #  span = transaction.start_child(hub=hub, op=item.name).__enter__()
    #  print(hub.scope.span.op)
    #  yield
    #  span.__exit__(None, None, None)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_setup(item):
    with hub.scope.span.start_child(op=item.name, description="pytest.setup"):
        yield


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item):
    #  call_span = hub.scope.span.start_child(op=item.name, description="pytest.call")
    #  call_spans[item.name] = call_span
    with hub.scope.span.start_child(op=item.name, description="pytest.call"):
        yield
    #  call_span.finish()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """
    If there is an existing call span, set a tag with the test outcome
    """

    report = yield

    # XXX: never runs
    # This should be the "call_span" from `pytest_runtest_call`
    #  call_span = call_spans.get(item.name)
    if hub.scope.span:
        hub.scope.span.set_tag("test.result", report.result.outcome)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_teardown(item, nextitem):
    with hub.scope.span.start_child(op=item.name, description="pytest.teardown"):
        yield

    global transaction
    if transaction and (nextitem is None or item.module.__name__ != nextitem.module.__name__):
        transaction.finish()
        transaction = None


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
