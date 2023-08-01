# TODO(mark) Remove once getsentry has been updated.
pytest_plugins = [
    "sentry.testutils.pytest.sentry",
    "sentry.testutils.pytest.selenium",
    "sentry.testutils.pytest.fixtures",
    "sentry.testutils.pytest.unittest",
    "sentry.testutils.pytest.kafka",
    "sentry.testutils.pytest.relay",
    "sentry.testutils.pytest.metrics",
    "sentry.testutils.pytest.stale_database_reads",
]
