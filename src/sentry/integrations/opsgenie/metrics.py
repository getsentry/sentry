from sentry.integrations.on_call.metrics import OnCallInteractionEvent, OnCallInteractionType
from sentry.integrations.on_call.spec import OpsgenieOnCallSpec
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError, ApiUnauthorized


def record_event(event: OnCallInteractionType) -> OnCallInteractionEvent:
    return OnCallInteractionEvent(event, OpsgenieOnCallSpec())


# 40301 - To perform this action, use an API key from an API integration.
OPSGENIE_HALT_ERRORS = (40301,)

# Infrastructure-level error patterns that should be treated as halts rather than failures
# These are typically temporary service availability issues outside our control
OPSGENIE_INFRASTRUCTURE_ERROR_PATTERNS = (
    "upstream connect error",
    "disconnect/reset before headers",
    "reset reason: overflow",
    "connection reset by peer",
    "gateway timeout",
    "bad gateway",
    "service temporarily unavailable",
)


def _is_infrastructure_error(error: ApiError) -> bool:
    """
    Check if an ApiError represents an infrastructure-level problem (e.g., gateway issues,
    proxy problems, upstream service outages) that should be treated as a halt rather than
    a failure to avoid creating noise in error tracking.

    Args:
        error: The ApiError to check

    Returns:
        True if this appears to be an infrastructure error, False otherwise
    """
    # Check for 503 Service Unavailable responses with infrastructure error patterns
    if error.code == 503 and error.text:
        error_text_lower = error.text.lower()
        return any(
            pattern in error_text_lower for pattern in OPSGENIE_INFRASTRUCTURE_ERROR_PATTERNS
        )

    # Check for 502 Bad Gateway responses (infrastructure issues)
    if error.code == 502:
        return True

    # Check for 504 Gateway Timeout responses (infrastructure issues)
    if error.code == 504:
        return True

    return False


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: ApiError) -> None:
    if isinstance(error, (ApiUnauthorized, ApiRateLimitedError)):
        lifecycle.record_halt(halt_reason=error)
    elif _is_infrastructure_error(error):
        # Infrastructure-level errors should be treated as halts, not failures,
        # to avoid creating noise for temporary service availability issues
        lifecycle.record_halt(halt_reason=error)
    elif error.json:
        if error.json.get("code") in OPSGENIE_HALT_ERRORS:
            lifecycle.record_halt(error)
        else:
            lifecycle.record_failure(error)
    else:
        lifecycle.record_failure(error)
