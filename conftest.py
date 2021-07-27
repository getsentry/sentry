import os
import sys

import pytest

pytest_plugins = ["sentry.utils.pytest"]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def pytest_configure(config):
    import warnings

    # XXX(dcramer): Kombu throws a warning due to transaction.commit_manually
    # being used
    warnings.filterwarnings("error", "", Warning, r"^(?!(|kombu|raven|sentry))")


def pytest_addoption(parser):
    parser.addoption(
        "--itunes",
        action="store_true",
        help="Run iTunes tests, see tests/sentry/utils/appleconnect/itunes",
    )


def pytest_runtest_setup(item):
    if item.get_closest_marker("itunes") and not item.config.getoption("--itunes"):
        pytest.skip("Test requires --itunes")
