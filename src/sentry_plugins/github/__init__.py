from __future__ import absolute_import

from sentry_plugins.base import assert_package_not_installed

assert_package_not_installed("sentry-github")

from sentry_plugins.github import options  # NOQA
