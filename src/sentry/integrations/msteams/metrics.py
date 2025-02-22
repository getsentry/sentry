from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError

# Generated based on the response from the MsTeams API
# Example: {"error":{"code":"ConversationBlockedByUser","message":"User blocked the conversation with the bot."}}
MSTEAMS_HALT_ERROR_CODES = [
    "BotDisabledByAdmin",
    "ConversationBlockedByUser",
    "ConversationNotFound",
    "TenantNoPermission",
]


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: ApiError) -> None:
    # permission_denied
    if error.code == 403:
        lifecycle.record_halt(error)
    elif isinstance(error, ApiRateLimitedError):
        # TODO(ecosystem): We should batch this on a per-organization basis
        lifecycle.record_halt(error)
    elif error.json:
        if error.json.get("error", {}).get("code") in MSTEAMS_HALT_ERROR_CODES:
            lifecycle.record_halt(error)
        else:
            lifecycle.record_failure(error)
    else:
        lifecycle.record_failure(error)
