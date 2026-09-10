from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiInvalidRequestError,
    ApiRateLimitedError,
    ApiUnauthorized,
    IntegrationConfigurationError,
    IntegrationError,
)

# Generated based on the response from the MsTeams API
# Example: {"error":{"code":"ConversationBlockedByUser","message":"User blocked the conversation with the bot."}}
MSTEAMS_INVALID_REQUEST_ERROR_CODES = {"BadSyntax", "ConversationNotFound"}
MSTEAMS_HALT_ERROR_CODES = {
    "BotDisabledByAdmin",
    "ConversationBlockedByUser",
    "TenantNoPermission",
    "CapabilityOverride",
}


class MsTeamsInvalidRequestError(ApiInvalidRequestError, IntegrationConfigurationError):
    def __init__(self, text: str, url: str | None = None) -> None:
        super().__init__(text, url=url)
        self.error_code = self.code


def record_lifecycle_termination_level(
    lifecycle: EventLifecycle, error: ApiError | IntegrationError
) -> None:
    if isinstance(error, IntegrationConfigurationError):
        lifecycle.record_halt(error)
    elif isinstance(error, IntegrationError):
        lifecycle.record_failure(error)
    else:
        try:
            translate_msteams_api_error(error)
        except (ApiInvalidRequestError, IntegrationConfigurationError) as translated_error:
            lifecycle.record_halt(translated_error)
        except IntegrationError as translated_error:
            lifecycle.record_failure(translated_error)


def translate_msteams_api_error(error: ApiError) -> None:
    if isinstance(error, (ApiUnauthorized, ApiRateLimitedError)):
        # 401 Unauthorized means expired/invalid credentials — a configuration issue, not a failure.
        # TODO(ecosystem): We should batch rate-limiting on a per-organization basis
        raise IntegrationConfigurationError(error.text) from error
    elif error.json:
        error_code = error.json.get("error", {}).get("code")
        if error_code in MSTEAMS_INVALID_REQUEST_ERROR_CODES:
            raise MsTeamsInvalidRequestError(error.text, url=error.url) from error
        elif error_code in MSTEAMS_HALT_ERROR_CODES:
            raise IntegrationConfigurationError(error.text) from error
        else:
            raise IntegrationError(error.text) from error
    else:
        raise IntegrationError(error.text) from error
