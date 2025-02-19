from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError

# https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
DISCORD_HALT_ERROR_CODES = [
    50001,  # Missing access (bot auth revoked)
    50013,  # Bot does not have permission to perform this action (e.g. sending messages in a channel the bot doesn't have access to)
    10003,  # Unknown Channel
]


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: ApiError) -> None:
    if isinstance(error, ApiRateLimitedError):
        # TODO(ecosystem): We should batch this on a per-organization basis
        lifecycle.record_halt(error)
    elif error.json and error.json.get("code") in DISCORD_HALT_ERROR_CODES:
        lifecycle.record_halt(error)
    else:
        lifecycle.record_failure(error)
