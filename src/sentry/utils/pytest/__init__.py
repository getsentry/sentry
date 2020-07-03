from __future__ import absolute_import

pytest_plugins = [
    "sentry.utils.pytest.sentry",
    "sentry.utils.pytest.selenium",
    "sentry.utils.pytest.fixtures",
    "sentry.utils.pytest.unittest",
    "sentry.utils.pytest.kafka",
    "sentry.utils.pytest.relay",
]
