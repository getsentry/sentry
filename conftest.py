from __future__ import absolute_import

import os
import sys

pytest_plugins = [
    'sentry.utils.pytest'
]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))


def pytest_configure(config):
    import warnings
    # XXX(dcramer): Riak throws a UserWarning re:OpenSSL which isnt important
    # to tests
    # XXX(dramer): Kombu throws a warning due to transaction.commit_manually
    # being used
    warnings.filterwarnings('error', '', Warning, r'^(?!(|kombu|raven|riak|sentry))')
