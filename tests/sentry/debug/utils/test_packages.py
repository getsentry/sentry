import sys

import sentry
from sentry.debug.utils.packages import get_package_version


def test_sentry_version_comes_from_sentry_module() -> None:
    assert get_package_version("sentry", sys.modules["sentry"]) == sentry.VERSION
