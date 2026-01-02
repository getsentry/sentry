from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiRateLimitedError,
    IntegrationConfigurationError,
    IntegrationError,
)

# Generated based on the response from the MsTeams API
# Example: {"error":{"code":"ConversationBlockedByUser","message":"User blocked the conversation with the bot."}}
MSTEAMS_HALT_ERROR_CODES = [
    "BotDisabledByAdmin",
    "ConversationBlockedByUser",
    "ConversationNotFound",
    "TenantNoPermission",
    "CapabilityOverride",
]


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: ApiError) -> None:
    try:
        translate_msteams_api_error(error)
    except IntegrationConfigurationError as e:
        lifecycle.record_halt(e)
    except IntegrationError as e:
        lifecycle.record_failure(e)


def translate_msteams_api_error(error: ApiError) -> None:
    if isinstance(error, ApiRateLimitedError):
        # TODO(ecosystem): We should batch this on a per-organization basis
        raise IntegrationConfigurationError(error.text) from error
    elif error.json:
        if error.json.get("error", {}).get("code") in MSTEAMS_HALT_ERROR_CODES:
            raise IntegrationConfigurationError(error.text) from error
        else:
            raise IntegrationError(error.text) from error
    else:
        raise IntegrationError(error.text) from error
