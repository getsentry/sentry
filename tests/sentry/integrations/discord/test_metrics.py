import pytest

from sentry.integrations.discord.utils.metrics import translate_discord_api_error
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiRateLimitedError,
    IntegrationConfigurationError,
    IntegrationError,
)


def test_rate_limit_is_a_halt() -> None:
    error = ApiRateLimitedError('{"message": "You are being rate limited.", "retry_after": 0.3}')
    with pytest.raises(IntegrationConfigurationError):
        translate_discord_api_error(error)


def test_unknown_error_is_a_failure() -> None:
    with pytest.raises(IntegrationError) as excinfo:
        translate_discord_api_error(ApiError('{"message": "Bad request", "code": 0}', code=400))
    assert not isinstance(excinfo.value, IntegrationConfigurationError)
