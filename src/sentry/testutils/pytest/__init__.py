import os

pytest_plugins = [
    "sentry.testutils.skips",
    "sentry.testutils.pytest.parallel",
    "sentry.testutils.pytest.sentry",
    "sentry.testutils.pytest.fixtures",
    "sentry.testutils.pytest.unittest",
    "sentry.testutils.pytest.kafka",
    "sentry.testutils.pytest.relay",
    "sentry.testutils.pytest.metrics",
    "sentry.testutils.pytest.stale_database_reads",
    "sentry.testutils.pytest.json_report_reruns",
    "sentry.testutils.pytest.show_flaky_failures",
    "sentry.testutils.thread_leaks.pytest",
]

if os.environ.get("SENTRY_SKIP_SELENIUM_PLUGIN") != "1":
    pytest_plugins.append("sentry.testutils.pytest.selenium")
