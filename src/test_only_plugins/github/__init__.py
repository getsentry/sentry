from __future__ import absolute_import

from test_only_plugins.base import assert_package_not_installed

assert_package_not_installed("sentry-github")

from test_only_plugins.github import options  # NOQA
