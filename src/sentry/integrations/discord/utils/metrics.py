from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiRateLimitedError,
    IntegrationConfigurationError,
    IntegrationError,
)

# https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
DISCORD_HALT_ERROR_CODES = [
    50001,  # Missing access (bot auth revoked)
    50013,  # Bot does not have permission to perform this action (e.g. sending messages in a channel the bot doesn't have access to)
    10003,  # Unknown Channel
]


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: ApiError) -> None:
    try:
        translate_discord_api_error(error)
    except IntegrationConfigurationError as e:
        lifecycle.record_halt(e)
    except IntegrationError as e:
        lifecycle.record_failure(e)


def translate_discord_api_error(error: ApiError) -> None:
    if isinstance(error, ApiRateLimitedError):
        # TODO(ecosystem): We should batch this on a per-organization basis
        raise IntegrationError(error.text) from error
    elif error.json and error.json.get("code") in DISCORD_HALT_ERROR_CODES:
        raise IntegrationConfigurationError(error.text) from error
    else:
        raise IntegrationError(error.text) from error
