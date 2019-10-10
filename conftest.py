from __future__ import absolute_import

import os
import sys
import subprocess
from hashlib import md5

import pytest

pytest_plugins = ["sentry.utils.pytest"]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def pytest_configure(config):
    import warnings

    # XXX(dcramer): Riak throws a UserWarning re:OpenSSL which isnt important
    # to tests
    # XXX(dramer): Kombu throws a warning due to transaction.commit_manually
    # being used
    warnings.filterwarnings("error", "", Warning, r"^(?!(|kombu|raven|riak|sentry))")


def pytest_collection_modifyitems(items):
    for item in items:
        total_groups = int(os.environ.get("TOTAL_TEST_GROUPS", 1))
        group_num = int(md5(item.location[0]).hexdigest(), 16) % total_groups
        item.add_marker(getattr(pytest.mark, "group_%s" % group_num))


@pytest.fixture(scope="session", autouse=True)
def callattr_ahead_of_alltests(request):
    """
    Generate frontend assets before running any acceptance tests
    """

    # Do not build in CI because tests are run w/ `make test-acceptance` which builds assets
    if os.environ["CI"]:
        return

    session = request.node
    has_acceptance = False
    for item in session.items:
        if item.location[0].startswith("tests/acceptance/"):
            has_acceptance = True
            break

    # Only run for acceptance tests
    if not has_acceptance:
        return

    subprocess.call("NODE_ENV=development yarn webpack", shell=True)
