from __future__ import absolute_import

pytest_plugins = [
    'sentry.utils.pytest'
]


def pytest_configure(config):
    import warnings
    warnings.filterwarnings('error', '', Warning, r'(sentry|raven)')
