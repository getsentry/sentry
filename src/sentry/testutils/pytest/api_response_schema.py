import pytest


@pytest.hookimpl(trylast=True)
def pytest_configure(config: pytest.Config) -> None:
    # The check needs Django settings, which `sentry.testutils.pytest.sentry` sets up in
    # its own pytest_configure, so it can't be imported with this module.
    from sentry.testutils.api_response_schema import Mode, ResponseSchemaReporter, mode_from_env

    mode = mode_from_env()
    if mode is not Mode.OFF:
        config.pluginmanager.register(ResponseSchemaReporter(mode), "sentry-api-response-schema")
